import { Response } from "express";
import { query } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import {
  mockUsers,
  mockOutlets,
  isDbConnectionError,
} from "../utils/mockStore";

// ============================================================
// User Controller
// Menampilkan daftar pengguna untuk panel "Kelola Pengguna & Peran"
// Hanya menampilkan user aktif; outlet dinormalisasi via JOIN/lookup.
// ============================================================

/**
 * GET /api/users
 * Mengembalikan user aktif beserta peran dan cabang.
 * - Mode DB: JOIN users → roles → outlets
 * - Mode mock: mapping dari mockUsers + mockOutlets
 */
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
         u.id,
         u.username,
         u.email,
         r.name  AS role,
         u.outlet_id,
         o.name  AS outlet_name,
         o.city
       FROM users u
       JOIN roles r  ON r.id = u.role_id
       LEFT JOIN outlets o ON o.id = u.outlet_id
       WHERE u.is_active = true
       ORDER BY u.id`,
    );

    res.json({ users: result.rows });

  } catch (error: any) {
    if (isDbConnectionError(error)) {
      const users = mockUsers
        .filter((u: any) => u.is_active)
        .map((u: any) => {
          const outlet = mockOutlets.find((o: any) => o.id === u.outlet_id);
          return {
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            outlet_id: u.outlet_id,
            outlet_name: outlet ? outlet.name : null,
            city: outlet ? outlet.city : null,
          };
        });

      return res.json({ users });
    }

    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
