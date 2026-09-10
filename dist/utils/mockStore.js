"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockTransactionItems = exports.mockTransactions = exports.mockLedger = exports.mockInventory = exports.mockProducts = exports.mockOutlets = exports.mockUsers = exports.mockRoles = void 0;
exports.isDbConnectionError = isDbConnectionError;
exports.nextProductId = nextProductId;
exports.nextOutletId = nextOutletId;
exports.nextInventoryId = nextInventoryId;
exports.nextLedgerId = nextLedgerId;
exports.nextTxnId = nextTxnId;
exports.nextUserId = nextUserId;
exports.ensureInventoryForProduct = ensureInventoryForProduct;
exports.ensureInventoryForOutlet = ensureInventoryForOutlet;
exports.findProductById = findProductById;
// ================================================================
// Roles & Users
// ================================================================
/** Daftar peran tetap — id selaras dengan seed schema.sql */
exports.mockRoles = [
    { id: 1, name: "super_admin" },
    { id: 2, name: "manager" },
    { id: 3, name: "cashier" },
];
/**
 * Pengguna awal (password semua = "password123").
 * Hash bcrypt di bawah adalah hash asli untuk "password123".
 */
exports.mockUsers = [
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
exports.mockOutlets = [
    { id: 1, name: "Outlet Pusat", city: "Jakarta", address: null, phone: null, is_active: true },
    { id: 2, name: "Outlet Cabang", city: "Bandung", address: null, phone: null, is_active: true },
];
let mockOutletSeq = 3;
// ================================================================
// Products & Inventory
// ================================================================
exports.mockProducts = [
    {
        id: 9001,
        sku: "PROD001",
        name: "Laptop",
        description: null,
        category_id: 1,
        base_price: 750000000,
        cost_price: 600000000,
        is_active: true,
    },
    {
        id: 9002,
        sku: "PROD002",
        name: "Mouse",
        description: null,
        category_id: 1,
        base_price: 25000000,
        cost_price: 15000000,
        is_active: true,
    },
];
let mockProductSeq = 9010;
exports.mockInventory = [];
let mockInventorySeq = 1;
exports.mockLedger = [];
let mockLedgerSeq = 1;
exports.mockTransactions = [];
exports.mockTransactionItems = [];
let mockTxnSeq = 1;
// Seed stok awal: tiap outlet × tiap produk = 25 unit
(function seedInventory() {
    for (const outlet of exports.mockOutlets) {
        for (const product of exports.mockProducts) {
            exports.mockInventory.push({
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
function isDbConnectionError(err) {
    if (!err)
        return false;
    const msg = String(err.message || "");
    return (err.code === "ECONNREFUSED" ||
        err.code === "28P01" ||
        err.code === "3D000" ||
        err.code === "ENOTFOUND" ||
        msg.includes("connect") ||
        msg.includes("password") ||
        msg.includes("authentication") ||
        msg.includes('database "pos_db" does not exist'));
}
// --- ID generators ---
function nextProductId() { return mockProductSeq++; }
function nextOutletId() { return mockOutletSeq++; }
function nextInventoryId() { return mockInventorySeq++; }
function nextLedgerId() { return mockLedgerSeq++; }
function nextTxnId() { return mockTxnSeq++; }
function nextUserId() { return mockUserSeq++; }
// --- Inventory helpers ---
/** Pastikan setiap outlet memiliki baris inventory untuk produk baru. */
function ensureInventoryForProduct(productId) {
    for (const outlet of exports.mockOutlets) {
        const exists = exports.mockInventory.some((row) => row.outlet_id === outlet.id
            && row.product_id === productId
            && (row.variant_id ?? -1) === -1);
        if (!exists) {
            exports.mockInventory.push({
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
function ensureInventoryForOutlet(outletId) {
    for (const product of exports.mockProducts) {
        const exists = exports.mockInventory.some((row) => row.outlet_id === outletId
            && row.product_id === product.id
            && (row.variant_id ?? -1) === -1);
        if (!exists) {
            exports.mockInventory.push({
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
function findProductById(id) {
    return exports.mockProducts.find((p) => p.id === id);
}
//# sourceMappingURL=mockStore.js.map