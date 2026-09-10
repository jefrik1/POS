# Dokumentasi — Manajemen Cabang & Pengguna

## Ringkasan
Admin (super_admin) dapat menambah cabang baru yang wajib disertai 2 akun terikat outlet: **manager** dan **kasir**. Akun muncul otomatis di **Kelola Pengguna & Peran**. Hapus cabang akan soft-delete outlet dan menonaktifkan manager/kasir terkait.

## Peran
- `super_admin` — akses semua outlet, kelola outlet & pengguna.
- `manager` — akses hanya outletnya (`outlet_id`), kelola inventory/laporan/transaksi.
- `cashier` — hanya transaksi outletnya.

## Endpoint

### POST /api/outlets
Membuat cabang + 2 akun. Hanya `super_admin` (`manage_outlets`).

**Body**
```json
{
  "name": "Outlet Baru",
  "city": "Surabaya",
  "address": null,
  "phone": null,
  "managerUsername": "manager_sby",
  "managerPassword": "rahasia1",
  "managerEmail": "manager_sby@pos.local",
  "cashierUsername": "kasir_sby",
  "cashierPassword": "rahasia2",
  "cashierEmail": "kasir_sby@pos.local"
}
```
`managerEmail`/`cashierEmail` opsional (default `<username>@pos.local`).

**Validasi**
- Username & password keduanya wajib; password minimal 6 karakter.
- `managerUsername` ≠ `cashierUsername` (case-insensitive).
- `managerPassword` ≠ `cashierPassword`.
- Username harus unik global (cek DB `users.username`).

**Flow**
1. Cek duplikasi username.
2. Transaksi atomik: `INSERT outlets` → hash password → `INSERT users (manager)` → `INSERT users (cashier)` → `INSERT inventory` (stok 0 untuk semua produk aktif).
3. Response `201` berisi `outlet` + `users[]`.
4. Fallback mock: jika DB down, data disimpan ke `mockStore` dan login tetap berfungsi via `bcrypt.compare`.

**Error**
- `400` — validasi gagal (`errors[]` berisi semua pelanggaran).
- `409` — outlet `name+city` atau username sudah ada.
- `500` — gagal DB.

### DELETE /api/outlets/:id
Menghapus cabang. Hanya `super_admin` (`manage_outlets`).

**Efek**
- `outlets.is_active = false` (soft delete, menjaga FK `transactions`/`stock_ledger`).
- `users.is_active = false` untuk semua user dengan `outlet_id = :id`.
- `DELETE FROM inventory WHERE outlet_id = :id` (histori transaksi tidak terhapus).

**Response**
```json
{
  "message": "Cabang \"Outlet Baru\" berhasil dihapus",
  "outletId": 3,
  "deactivatedUsers": [{"id": 10, "username": "manager_sby"}],
  "deactivatedCount": 2
}
```
Fallback mock melakukan hal yang sama pada array `mockOutlets`/`mockUsers`/`mockInventory`.

### GET /api/outlets
Daftar outlet aktif (`is_active = true`), terurut `id`. Fallback ke `mockOutlets`.

### GET /api/users
Daftar pengguna aktif (`u.is_active = true`) beserta `role` dan `outlet_name/city` via `LEFT JOIN`. Fallback ke `mockUsers` yang `is_active`.

### GET /api/dashboard/summary?outletId=
Ringkasan harian (transaksi `completed` hari ini). `super_admin` bisa filter `outletId`, role lain terkunci ke `req.user.outletId`.

## Frontend — public/admin.html

### Kelola Outlet / Cabang
- Tabel menampilkan `Nama | Kota | Status | Aksi (Hapus)`.
- Tombol **Hapus** memanggil `deleteOutlet(id, name)` → `confirm()` → `DELETE /api/outlets/:id` → refresh outlet + users + dashboard.
- Form tambah cabang: `Nama | Kota | Username Manager | Password Manager | Username Kasir | Password Kasir` + validasi sisi klien identik dengan backend.
- Pesan sukses/error tampil di `#outletMsg`.

### Kelola Pengguna & Peran
- `GET /api/users` → render `username | role badge | cabang`.
- Otomatis ter-refresh setelah tambah/hapus cabang.

### Fungsi JS utama
- `getToken()` — ambil `accessToken` dari localStorage.
- `refreshDashboard()` — `GET /api/dashboard/summary`.
- `loadOutlets()` — `GET /api/outlets`, update tabel + dropdown + counter cabang aktif.
- `loadUsers()` — `GET /api/users`.
- `createOutlet()` — validasi + `POST /api/outlets`.
- `deleteOutlet(id, name)` — konfirmasi + `DELETE /api/outlets/:id`.
- `escapeHtml()` — sanitasi render.

## File yang diubah/dirapikan
- `src/controllers/outletController.ts` — dibagi per seksi dengan komentar, fungsi `validateOutletUsers`/`handleCreateOutletMock`/`handleDeleteOutletMock` terpisah, `deleteOutlet` baru.
- `src/controllers/userController.ts` — komentar + filter `is_active`, mapping mock konsisten.
- `src/utils/mockStore.ts` — header & seksi, komentar per helper, `isDbConnectionError` terdokumentasi.
- `src/routes/index.ts` — route `DELETE /outlets/:id` + `GET /users` tertata.
- `public/admin.html` — struktur rapi, seksi berkomentar, XSS-safe via `escapeHtml`, kolom Aksi Hapus.

## Cara uji manual
1. Login sebagai `admin / password123` → `/admin.html`.
2. Isi form tambah cabang dengan 4 kredensial berbeda → **Tambah Cabang + Buat Akun**.
3. Cek tabel **Kelola Pengguna & Peran** — 2 akun baru muncul.
4. Login sebagai manager/kasir baru — berhasil (DB & mock).
5. Klik **Hapus** pada cabang baru → konfirmasi → cabang hilang, 2 akun lenyap dari Kelola Pengguna; login dengan akun tersebut kini `401`.
