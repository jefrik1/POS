"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = void 0;
const database_1 = require("../config/database");
const mockStore_1 = require("../utils/mockStore");
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
const getUsers = async (req, res) => {
    try {
        const result = await (0, database_1.query)(`SELECT
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
       ORDER BY u.id`);
        res.json({ users: result.rows });
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            const users = mockStore_1.mockUsers
                .filter((u) => u.is_active)
                .map((u) => {
                const outlet = mockStore_1.mockOutlets.find((o) => o.id === u.outlet_id);
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
exports.getUsers = getUsers;
//# sourceMappingURL=userController.js.map