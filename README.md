# POS Multi-Outlet

Sistem kasir berbasis web untuk multi-cabang dengan stok per-outlet dan akses berbasis peran.

## Fitur
- **Auth RBAC** — `super_admin` / `manager` / `cashier`, JWT 15 menit + refresh token httpOnly
- **Manajemen Cabang** — tambah cabang wajib buat 2 akun (manager & kasir, username/password harus beda & unik); hapus cabang = soft delete + nonaktifkan manager/kasir otomatis
- **Inventaris** — katalog SKU, varian, stok per-outlet, ledger stok immutable, alert stok menipis
- **Kasir** — pencarian/barcode, diskon & pajak presisi (Decimal.js), offline IndexedDB + sync
- **Laporan** — ringkasan harian, produk terlaris, performa kasir, export CSV

## Tech Stack
- **Backend:** Node.js + TypeScript + Express + PostgreSQL + JWT/bcrypt
- **Frontend:** HTML/CSS/Vanilla JS + IndexedDB + Service Worker (PWA)


## Akun Demo
| Peran | Username | Password | Akses |
|-------|----------|----------|-------|
| Super Admin | `admin` | `password123` | Semua cabang |
| Manager | `manager` | `password123` | 1 outlet |
| Kasir | `cashier` | `password123` | Transaksi outletnya |

## Endpoint
| Method | Path | Ket |
|--------|------|-----|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| GET/POST | `/api/outlets` | List / tambah cabang (super_admin) |
| DELETE | `/api/outlets/:id` | Hapus cabang (super_admin) |
| GET | `/api/users` | Daftar pengguna aktif |
| GET/POST | `/api/products` | List / tambah produk |
| GET | `/api/inventory` | Stok per outlet |
| POST | `/api/inventory/adjust` | Mutasi stok |
| POST | `/api/transactions` | Buat transaksi |
| GET | `/api/reports/*` | Sales, top-selling, cashier, export |

## Struktur
```
src/{config,schemas} controllers/ middleware/ routes/ utils/
public/{*.html, css/, js/}
```

## Lisensi
MIT
