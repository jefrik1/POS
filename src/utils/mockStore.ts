/**
 * mockStore.ts
 * ------------------------------------------------------------------
 * Penyimpanan in-memory sebagai fallback ketika koneksi PostgreSQL
 * tidak tersedia. Struktur data meniru tabel DB agar controller
 * dapat berjalan identik di mode DB maupun mock.
 *
 * Dipakai oleh: outletController, authController, userController,
 *               product/inventory/transaction controllers.
 */

// ================================================================
// Roles & Users
// ================================================================

/** Daftar peran tetap — id selaras dengan seed schema.sql */
export const mockRoles: any[] = [
  { id: 1, name: "super_admin" },
  { id: 2, name: "manager" },
  { id: 3, name: "cashier" },
];

/**
 * Pengguna awal (password semua = "password123").
 * Hash bcrypt di bawah adalah hash asli untuk "password123".
 */
export const mockUsers: any[] = [
  {
    id: 1,
    username: "admin",
    email: "admin@pos.local",
    role: "super_admin",
    role_id: 1,
    outlet_id: null,
    is_active: true,
    password_hash: "$2a$10$sfEeC02yU0udFtNt/omHYOp7VXfo9zCSjQa/SzEXTURNBtdXrmHsu",
  },
  {
    id: 2,
    username: "manager",
    email: "manager@pos.local",
    role: "manager",
    role_id: 2,
    outlet_id: 1,
    is_active: true,
    password_hash: "$2a$10$sfEeC02yU0udFtNt/omHYOp7VXfo9zCSjQa/SzEXTURNBtdXrmHsu",
  },
  {
    id: 3,
    username: "cashier",
    email: "cashier@pos.local",
    role: "cashier",
    role_id: 3,
    outlet_id: 1,
    is_active: true,
    password_hash: "$2a$10$sfEeC02yU0udFtNt/omHYOp7VXfo9zCSjQa/SzEXTURNBtdXrmHsu",
  },
];

let mockUserSeq = 4;

// ================================================================
// Outlets
// ================================================================

export const mockOutlets: any[] = [
  { id: 1, name: "Outlet Pusat",  city: "Jakarta", address: null, phone: null, is_active: true },
  { id: 2, name: "Outlet Cabang", city: "Bandung", address: null, phone: null, is_active: true },
];

let mockOutletSeq = 3;

// ================================================================
// Products & Inventory
// ================================================================

export const mockProducts: any[] = [
  {
    id: 9001,
    sku: "PROD001",
    name: "Laptop",
    description: null,
    category_id: 1,
    base_price: 7500_000_00,
    cost_price: 6000_000_00,
    is_active: true,
  },
  {
    id: 9002,
    sku: "PROD002",
    name: "Mouse",
    description: null,
    category_id: 1,
    base_price: 250_000_00,
    cost_price: 150_000_00,
    is_active: true,
  },
];

let mockProductSeq = 9010;

export const mockInventory: any[] = [];
let mockInventorySeq = 1;

export const mockLedger: any[] = [];
let mockLedgerSeq = 1;

export const mockTransactions: any[] = [];
export const mockTransactionItems: any[] = [];
let mockTxnSeq = 1;

// Seed stok awal: tiap outlet × tiap produk = 25 unit
(function seedInventory() {
  for (const outlet of mockOutlets) {
    for (const product of mockProducts) {
      mockInventory.push({
        id: mockInventorySeq++,
        outlet_id: outlet.id,
        product_id: product.id,
        variant_id: null,
        quantity: 25,
        minimum_stock: 10,
        updated_at: new Date().toISOString(),
      });
    }
  }
})();

// ================================================================
// Helpers
// ================================================================

/** Deteksi error koneksi DB agar controller bisa fallback ke mock. */
export function isDbConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.code === "ECONNREFUSED" ||
    err.code === "28P01" ||
    err.code === "3D000" ||
    err.code === "ENOTFOUND" ||
    msg.includes("connect") ||
    msg.includes("password") ||
    msg.includes("authentication") ||
    msg.includes('database "pos_db" does not exist')
  );
}

// --- ID generators ---

export function nextProductId(): number   { return mockProductSeq++; }
export function nextOutletId(): number    { return mockOutletSeq++; }
export function nextInventoryId(): number { return mockInventorySeq++; }
export function nextLedgerId(): number    { return mockLedgerSeq++; }
export function nextTxnId(): number       { return mockTxnSeq++; }
export function nextUserId(): number      { return mockUserSeq++; }

// --- Inventory helpers ---

/** Pastikan setiap outlet memiliki baris inventory untuk produk baru. */
export function ensureInventoryForProduct(productId: number): void {
  for (const outlet of mockOutlets) {
    const exists = mockInventory.some(
      (row) => row.outlet_id === outlet.id
            && row.product_id === productId
            && (row.variant_id ?? -1) === -1,
    );
    if (!exists) {
      mockInventory.push({
        id: mockInventorySeq++,
        outlet_id: outlet.id,
        product_id: productId,
        variant_id: null,
        quantity: 0,
        minimum_stock: 10,
        updated_at: new Date().toISOString(),
      });
    }
  }
}

/** Pastikan outlet baru memiliki baris inventory untuk semua produk. */
export function ensureInventoryForOutlet(outletId: number): void {
  for (const product of mockProducts) {
    const exists = mockInventory.some(
      (row) => row.outlet_id === outletId
            && row.product_id === product.id
            && (row.variant_id ?? -1) === -1,
    );
    if (!exists) {
      mockInventory.push({
        id: mockInventorySeq++,
        outlet_id: outletId,
        product_id: product.id,
        variant_id: null,
        quantity: 0,
        minimum_stock: 10,
        updated_at: new Date().toISOString(),
      });
    }
  }
}

// --- Lookup ---

export function findProductById(id: number): any | undefined {
  return mockProducts.find((p) => p.id === id);
}
