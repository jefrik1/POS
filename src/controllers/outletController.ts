import { Response } from "express";
import { query, withTransaction } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { hashPassword } from "../utils/auth";
import {
  mockOutlets,
  mockUsers,
  isDbConnectionError,
  nextOutletId,
  nextUserId,
  ensureInventoryForOutlet,
} from "../utils/mockStore";

// ============================================================
// Outlet Controller
// Mengelola CRUD outlet/cabang + auto-provision akun
// ============================================================

// ------------------------------------------------------------
// GET /api/outlets — daftar outlet aktif
// ------------------------------------------------------------
export const getOutlets = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, city, address, phone, is_active, created_at
       FROM outlets WHERE is_active = true ORDER BY id`,
    );
    res.json({ outlets: result.rows });
  } catch (error: any) {
    if (isDbConnectionError(error)) {
      return res.json({ outlets: mockOutlets.filter((o) => o.is_active) });
    }
    console.error("Get outlets error:", error);
    res.status(500).json({ error: "Failed to fetch outlets" });
  }
};

// ------------------------------------------------------------
// Validasi kredensial manager & kasir wajib saat buat outlet
// Aturan:
//  - username & password keduanya wajib
//  - password min 6 karakter
//  - username manager ≠ kasir, password manager ≠ kasir
//  - semua harus unik global (dicek terpisah via DB)
// ------------------------------------------------------------
function validateOutletUsers(body: any): string[] {
  const {
    managerUsername,
    managerPassword,
    cashierUsername,
    cashierPassword,
  } = body;

  const errors: string[] = [];

  if (!managerUsername || !String(managerUsername).trim()) {
    errors.push("Username manager wajib diisi");
  }
  if (!managerPassword || String(managerPassword).length < 6) {
    errors.push("Password manager minimal 6 karakter");
  }
  if (!cashierUsername || !String(cashierUsername).trim()) {
    errors.push("Username kasir wajib diisi");
  }
  if (!cashierPassword || String(cashierPassword).length < 6) {
    errors.push("Password kasir minimal 6 karakter");
  }

  const mUser = String(managerUsername || "").trim().toLowerCase();
  const cUser = String(cashierUsername || "").trim().toLowerCase();

  if (mUser && cUser && mUser === cUser) {
    errors.push("Username manager dan kasir harus berbeda");
  }
  if (managerPassword && cashierPassword && managerPassword === cashierPassword) {
    errors.push("Password manager dan kasir harus berbeda");
  }

  return errors;
}

// ------------------------------------------------------------
// POST /api/outlets — buat cabang baru + 2 akun terikat outlet
// Body: { name, city, address?, phone?, managerUsername,
//         managerPassword, managerEmail?, cashierUsername,
//         cashierPassword, cashierEmail? }
// Flow DB: transaksi atomik (outlet + 2 users + inventory)
// Flow mock (DB down): simpan ke mockStore
// Response: outlet + users[]
// ------------------------------------------------------------
export const createOutlet = async (req: AuthRequest, res: Response) => {
  const {
    name,
    city,
    address,
    phone,
    managerUsername,
    managerPassword,
    managerEmail,
    cashierUsername,
    cashierPassword,
    cashierEmail,
  } = req.body;

  // --- validasi dasar ---
  if (!name || !city) {
    return res.status(400).json({ error: "Nama dan kota wajib diisi" });
  }

  const credentialErrors = validateOutletUsers(req.body);
  if (credentialErrors.length > 0) {
    return res.status(400).json({ error: credentialErrors[0], errors: credentialErrors });
  }

  const trimmedName = String(name).trim();
  const trimmedCity = String(city).trim();
  const mUser = String(managerUsername).trim();
  const cUser = String(cashierUsername).trim();

  if (trimmedName.length < 2) {
    return res.status(400).json({ error: "Nama cabang minimal 2 karakter" });
  }

  // --- jalur database ---
  try {
    // Cek username sudah dipakai
    const dupe = await query(
      `SELECT username FROM users WHERE username IN ($1, $2)`,
      [mUser, cUser],
    );
    if (dupe.rows.length > 0) {
      const taken = dupe.rows.map((r: any) => r.username).join(", ");
      return res.status(409).json({ error: `Username sudah dipakai: ${taken}` });
    }

    // Transaksi: outlet → users → inventory
    const outlet = await withTransaction(async (client) => {
      const outletResult = await client.query(
        `INSERT INTO outlets (name, city, address, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, city, address, phone, is_active, created_at`,
        [trimmedName, trimmedCity, address || null, phone || null],
      );
      const outletRow = outletResult.rows[0];

      const managerHash = await hashPassword(String(managerPassword));
      const cashierHash = await hashPassword(String(cashierPassword));

      const managerRole = await client.query(`SELECT id FROM roles WHERE name = 'manager'`);
      const cashierRole = await client.query(`SELECT id FROM roles WHERE name = 'cashier'`);

      await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, outlet_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [mUser, managerEmail ? String(managerEmail).trim() : `${mUser}@pos.local`, managerHash, managerRole.rows[0].id, outletRow.id],
      );

      await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, outlet_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [cUser, cashierEmail ? String(cashierEmail).trim() : `${cUser}@pos.local`, cashierHash, cashierRole.rows[0].id, outletRow.id],
      );

      // Siapkan stok awal 0 untuk semua produk aktif
      try {
        await client.query(
          `INSERT INTO inventory (outlet_id, product_id, variant_id, quantity, minimum_stock)
           SELECT $1, p.id, NULL, 0, 10
           FROM products p
           WHERE p.is_active = true
             AND NOT EXISTS (
               SELECT 1 FROM inventory i
               WHERE i.outlet_id = $1 AND i.product_id = p.id AND i.variant_id IS NULL
             )`,
          [outletRow.id],
        );
      } catch (e) {
        console.warn("Auto inventory for new outlet failed:", e);
      }

      return outletRow;
    });

    const createdUsers = await query(
      `SELECT u.id, u.username, u.email, r.name AS role, u.outlet_id
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.outlet_id = $1 ORDER BY r.name`,
      [outlet.id],
    );

    return res.status(201).json({ ...outlet, users: createdUsers.rows });

  } catch (error: any) {
    // --- fallback mock saat DB tidak tersedia ---
    if (isDbConnectionError(error)) {
      return handleCreateOutletMock(req, res, {
        trimmedName, trimmedCity, address, phone,
        mUser, cUser, managerPassword, cashierPassword,
        managerEmail, cashierEmail,
      });
    }

    if (error?.code === "23505") {
      return res.status(409).json({ error: "Outlet / username sudah ada" });
    }

    console.error("Create outlet error:", error);
    return res.status(500).json({ error: "Failed to create outlet", detail: error?.message });
  }
};

/**
 * Fallback in-memory saat koneksi DB gagal.
 * Mencatat outlet & 2 user ke mockStore.
 */
async function handleCreateOutletMock(
  req: AuthRequest,
  res: Response,
  ctx: {
    trimmedName: string; trimmedCity: string; address: any; phone: any;
    mUser: string; cUser: string; managerPassword: string; cashierPassword: string;
    managerEmail: any; cashierEmail: any;
  },
) {
  const { trimmedName, trimmedCity, address, phone, mUser, cUser, managerPassword, cashierPassword, managerEmail, cashierEmail } = ctx;

  const duplicate = mockOutlets.some(
    (o) => o.name.toLowerCase() === trimmedName.toLowerCase()
        && o.city.toLowerCase() === trimmedCity.toLowerCase(),
  );
  if (duplicate) {
    return res.status(409).json({ error: "Outlet dengan nama & kota tersebut sudah ada" });
  }

  const userTaken = mockUsers.some(
    (u) => u.username.toLowerCase() === mUser.toLowerCase()
        || u.username.toLowerCase() === cUser.toLowerCase(),
  );
  if (userTaken) {
    return res.status(409).json({ error: "Username manager/kasir sudah dipakai" });
  }

  const newOutlet: any = {
    id: nextOutletId(),
    name: trimmedName,
    city: trimmedCity,
    address: address || null,
    phone: phone || null,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  mockOutlets.push(newOutlet);
  ensureInventoryForOutlet(newOutlet.id);

  const managerHash = await hashPassword(String(managerPassword));
  const cashierHash = await hashPassword(String(cashierPassword));

  const managerUser: any = {
    id: nextUserId(),
    username: mUser,
    email: managerEmail ? String(managerEmail).trim() : `${mUser}@pos.local`,
    password_hash: managerHash,
    role: "manager",
    role_id: 2,
    outlet_id: newOutlet.id,
    is_active: true,
  };
  const cashierUser: any = {
    id: nextUserId(),
    username: cUser,
    email: cashierEmail ? String(cashierEmail).trim() : `${cUser}@pos.local`,
    password_hash: cashierHash,
    role: "cashier",
    role_id: 3,
    outlet_id: newOutlet.id,
    is_active: true,
  };
  mockUsers.push(managerUser, cashierUser);

  return res.status(201).json({
    ...newOutlet,
    users: [
      { id: managerUser.id, username: managerUser.username, email: managerUser.email, role: "manager", outlet_id: newOutlet.id },
      { id: cashierUser.id, username: cashierUser.username, email: cashierUser.email, role: "cashier", outlet_id: newOutlet.id },
    ],
  });
}

// ------------------------------------------------------------
// DELETE /api/outlets/:id — hapus cabang + nonaktifkan akun
// Hanya super_admin (requirePermission manage_outlets).
// - Soft delete outlet: is_active = false
// - Nonaktifkan semua user terikat outlet: is_active = false
// - Hapus inventory outlet (opsional, aman tanpa FK transaksi)
// Alasan soft delete: menjaga integritas FK transaksi & ledger.
// ------------------------------------------------------------
export const deleteOutlet = async (req: AuthRequest, res: Response) => {
  const outletId = Number(req.params.id);

  if (!Number.isInteger(outletId) || outletId <= 0) {
    return res.status(400).json({ error: "ID outlet tidak valid" });
  }

  try {
    const exists = await query(`SELECT id, name, is_active FROM outlets WHERE id = $1`, [outletId]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Outlet tidak ditemukan" });
    }
    if (exists.rows[0].is_active === false) {
      return res.status(409).json({ error: "Outlet sudah nonaktif/dihapus" });
    }

    const result = await withTransaction(async (client) => {
      const userResult = await client.query(
        `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE outlet_id = $1 AND is_active = true
         RETURNING id, username`,
        [outletId],
      );

      await client.query(
        `UPDATE outlets SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [outletId],
      );

      // Bersihkan inventory outlet (tidak mengganggu histori transaksi)
      await client.query(`DELETE FROM inventory WHERE outlet_id = $1`, [outletId]);

      return { deactivatedUsers: userResult.rows };
    });

    return res.json({
      message: `Cabang "${exists.rows[0].name}" berhasil dihapus`,
      outletId,
      deactivatedUsers: result.deactivatedUsers,
      deactivatedCount: result.deactivatedUsers.length,
    });

  } catch (error: any) {
    if (isDbConnectionError(error)) {
      return handleDeleteOutletMock(res, outletId);
    }
    console.error("Delete outlet error:", error);
    return res.status(500).json({ error: "Failed to delete outlet", detail: error?.message });
  }
};

/**
 * Fallback hapus di mockStore (DB down).
 * Menandai outlet is_active=false & user terkait is_active=false.
 */
function handleDeleteOutletMock(res: Response, outletId: number) {
  const outlet = mockOutlets.find((o) => o.id === outletId);
  if (!outlet) {
    return res.status(404).json({ error: "Outlet tidak ditemukan" });
  }
  if (!outlet.is_active) {
    return res.status(409).json({ error: "Outlet sudah nonaktif/dihapus" });
  }

  outlet.is_active = false;

  const affected = mockUsers.filter((u) => u.outlet_id === outletId && u.is_active);
  for (const u of affected) u.is_active = false;

  // Bersihkan inventory mock outlet tersebut
  try {
    const { mockInventory } = require("../utils/mockStore");
    const keep = (mockInventory as any[]).filter((i: any) => i.outlet_id !== outletId);
    (mockInventory as any[]).length = 0;
    for (const row of keep) (mockInventory as any[]).push(row);
  } catch {}

  return res.json({
    message: `Cabang "${outlet.name}" berhasil dihapus`,
    outletId,
    deactivatedUsers: affected.map((u: any) => ({ id: u.id, username: u.username })),
    deactivatedCount: affected.length,
  });
}

// ------------------------------------------------------------
// GET /api/dashboard/summary — ringkasan harian
// super_admin bisa filter ?outletId=, role lain terkunci ke outletnya
// ------------------------------------------------------------
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  const outletId = (req.query as any).outletId;
  const effectiveOutletId = req.user?.role === "super_admin" ? outletId || null : req.user?.outletId;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    let sql = `
      SELECT COUNT(t.id) AS transaction_count,
             COALESCE(SUM(t.total_amount), 0) AS total_revenue,
             COALESCE(SUM(ti_qty.qty), 0) AS total_sold
      FROM transactions t
      LEFT JOIN (
        SELECT transaction_id, SUM(quantity) AS qty
        FROM transaction_items GROUP BY transaction_id
      ) ti_qty ON ti_qty.transaction_id = t.id
      WHERE t.status = 'completed' AND t.created_at >= $1
    `;
    const params: any[] = [todayIso];

    if (effectiveOutletId) {
      sql += ` AND t.outlet_id = $2`;
      params.push(Number(effectiveOutletId));
    }

    const r = await query(sql, params);
    const row = r.rows[0];

    res.json({
      today: {
        transactionCount: parseInt(row.transaction_count || 0, 10),
        totalRevenue: Number(row.total_revenue || 0) / 100,
        totalSold: parseInt(row.total_sold || 0, 10),
      },
    });

  } catch (error: any) {
    if (isDbConnectionError(error)) {
      const { mockTransactions, mockTransactionItems } = await import("../utils/mockStore");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let filtered = mockTransactions.filter(
        (t: any) => new Date(t.created_at) >= todayStart && t.status === "completed",
      );
      if (effectiveOutletId) {
        filtered = filtered.filter((t: any) => t.outlet_id === Number(effectiveOutletId));
      }

      const totalRevenue = filtered.reduce((a: any, b: any) => a + Number(b.total_amount || 0), 0) / 100;
      const ids = new Set(filtered.map((t: any) => t.id));
      const totalSold = mockTransactionItems
        .filter((it: any) => ids.has(it.transaction_id))
        .reduce((a: any, b: any) => a + Number(b.quantity || 0), 0);

      return res.json({ today: { transactionCount: filtered.length, totalRevenue, totalSold } });
    }

    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed" });
  }
};
