"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOutletContext = exports.requirePermission = exports.requireRole = exports.authMiddleware = void 0;
const auth_1 = require("../utils/auth");
const constants_1 = require("../constants");
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    const decoded = (0, auth_1.verifyAccessToken)(token);
    if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
};
exports.authMiddleware = authMiddleware;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const permissions = constants_1.ROLE_PERMISSIONS[req.user.role] || [];
        if (!permissions.includes(permission)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
const requireOutletContext = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.user.role !== "super_admin" && !req.user.outletId) {
        return res.status(403).json({ error: "Outlet context required" });
    }
    next();
};
exports.requireOutletContext = requireOutletContext;
//# sourceMappingURL=auth.js.map