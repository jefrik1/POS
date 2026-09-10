"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refreshAccessToken = exports.login = exports.register = void 0;
const database_1 = require("../config/database");
const auth_1 = require("../utils/auth");
const register = async (req, res) => {
    try {
        const { username, email, password, roleId, outletId } = req.body;
        if (!username || !email || !password || !roleId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const existingUser = await (0, database_1.query)("SELECT id FROM users WHERE username = $1 OR email = $2", [username, email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: "User already exists" });
        }
        const passwordHash = await (0, auth_1.hashPassword)(password);
        const result = await (0, database_1.query)(`INSERT INTO users (username, email, password_hash, role_id, outlet_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role_id, outlet_id`, [username, email, passwordHash, roleId, outletId || null]);
        const user = result.rows[0];
        res.status(201).json({ user });
    }
    catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Registration failed" });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }
        const result = await (0, database_1.query)(`SELECT u.id, u.username, u.password_hash, u.role_id, u.outlet_id, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1 AND u.is_active = true`, [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const user = result.rows[0];
        const passwordMatch = await (0, auth_1.comparePassword)(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const accessToken = (0, auth_1.generateAccessToken)({
            userId: user.id,
            role: user.role,
            outletId: user.outlet_id,
        });
        const refreshToken = (0, auth_1.generateRefreshToken)(user.id);
        const refreshTokenHash = (0, auth_1.hashRefreshToken)(refreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await (0, database_1.query)(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`, [user.id, refreshTokenHash, expiresAt]);
        await (0, database_1.query)("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.json({
            accessToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                outletId: user.outlet_id,
            },
        });
    }
    catch (error) {
        const { isDbConnectionError, mockUsers } = await Promise.resolve().then(() => __importStar(require("../utils/mockStore")));
        if (isDbConnectionError(error)) {
            const u = mockUsers.find((x) => x.username === req.body.username && x.is_active);
            if (!u)
                return res.status(401).json({ error: "Invalid credentials" });
            const ok = u.password === req.body.password || await (0, auth_1.comparePassword)(req.body.password, u.password_hash).catch(() => false);
            if (!ok)
                return res.status(401).json({ error: "Invalid credentials" });
            const { generateAccessToken: gen } = await Promise.resolve().then(() => __importStar(require("../utils/auth")));
            const accessToken = gen({ userId: u.id, role: u.role, outletId: u.outlet_id });
            return res.json({ accessToken, user: { id: u.id, username: u.username, role: u.role, outletId: u.outlet_id } });
        }
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
};
exports.login = login;
const refreshAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: "No refresh token provided" });
        }
        const decoded = (0, auth_1.verifyRefreshToken)(refreshToken);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid refresh token" });
        }
        const tokenResult = await (0, database_1.query)(`SELECT id FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`, [decoded.userId]);
        if (tokenResult.rows.length === 0) {
            return res
                .status(401)
                .json({ error: "Refresh token not found or expired" });
        }
        const userResult = await (0, database_1.query)(`SELECT u.id, u.role_id, u.outlet_id, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`, [decoded.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: "User not found" });
        }
        const user = userResult.rows[0];
        const newAccessToken = (0, auth_1.generateAccessToken)({
            userId: user.id,
            role: user.role,
            outletId: user.outlet_id,
        });
        res.json({ accessToken: newAccessToken });
    }
    catch (error) {
        console.error("Refresh token error:", error);
        res.status(500).json({ error: "Token refresh failed" });
    }
};
exports.refreshAccessToken = refreshAccessToken;
const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken && req.user) {
            const tokenHash = (0, auth_1.hashRefreshToken)(refreshToken);
            await (0, database_1.query)("UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND token_hash = $2", [req.user.userId, tokenHash]);
        }
        res.clearCookie("refreshToken");
        res.json({ message: "Logged out successfully" });
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Logout failed" });
    }
};
exports.logout = logout;
//# sourceMappingURL=authController.js.map