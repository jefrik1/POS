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
/** Daftar peran tetap — id selaras dengan seed schema.sql */
export declare const mockRoles: any[];
/**
 * Pengguna awal (password semua = "password123").
 * Hash bcrypt di bawah adalah hash asli untuk "password123".
 */
export declare const mockUsers: any[];
export declare const mockOutlets: any[];
export declare const mockProducts: any[];
export declare const mockInventory: any[];
export declare const mockLedger: any[];
export declare const mockTransactions: any[];
export declare const mockTransactionItems: any[];
/** Deteksi error koneksi DB agar controller bisa fallback ke mock. */
export declare function isDbConnectionError(err: any): boolean;
export declare function nextProductId(): number;
export declare function nextOutletId(): number;
export declare function nextInventoryId(): number;
export declare function nextLedgerId(): number;
export declare function nextTxnId(): number;
export declare function nextUserId(): number;
/** Pastikan setiap outlet memiliki baris inventory untuk produk baru. */
export declare function ensureInventoryForProduct(productId: number): void;
/** Pastikan outlet baru memiliki baris inventory untuk semua produk. */
export declare function ensureInventoryForOutlet(outletId: number): void;
export declare function findProductById(id: number): any | undefined;
//# sourceMappingURL=mockStore.d.ts.map