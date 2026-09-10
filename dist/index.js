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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const routes_1 = __importDefault(require("./routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === "production"
        ? process.env.CORS_ORIGIN
        : "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
// Mock API untuk development (saat database tidak tersedia)
const mockUsers = {
    admin: {
        id: 1,
        username: "admin",
        email: "admin@pos.local",
        role: "super_admin",
        outletId: null,
    },
    manager: {
        id: 2,
        username: "manager",
        email: "manager@pos.local",
        role: "manager",
        outletId: 1,
    },
    cashier: {
        id: 3,
        username: "cashier",
        email: "cashier@pos.local",
        role: "cashier",
        outletId: 1,
    },
};
app.post("/api/auth/login-mock", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: "Username and password required" });
    let user = mockUsers[username];
    if (!user) {
        try {
            const { mockUsers: dyn, mockOutlets: _o } = await Promise.resolve().then(() => __importStar(require("./utils/mockStore")));
            const bcrypt = await Promise.resolve().then(() => __importStar(require("bcryptjs")));
            const found = dyn.find((u) => u.username === username);
            if (found) {
                const ok = await bcrypt.compare(password, found.password_hash);
                if (!ok)
                    return res.status(401).json({ error: "Invalid credentials" });
                user = { id: found.id, username: found.username, role: found.role, outletId: found.outlet_id };
            }
            else
                return res.status(401).json({ error: "Invalid credentials" });
        }
        catch {
            return res.status(401).json({ error: "Invalid credentials" });
        }
    }
    else {
        if (password !== "password123")
            return res.status(401).json({ error: "Invalid credentials" });
    }
    const accessToken = jsonwebtoken_1.default.sign({
        userId: user.id,
        role: user.role,
        outletId: user.outletId,
    }, process.env.JWT_SECRET || "secret", { expiresIn: "15m" });
    res.cookie("refreshToken", "mock_refresh", {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
    });
    res.json({
        accessToken,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            outletId: user.outletId,
        },
    });
});
app.get("/api/products-mock", (req, res) => {
    const mockProducts = [
        {
            id: 1,
            sku: "PROD001",
            name: "Laptop",
            basePrice: 7500000,
            costPrice: 6000000,
        },
        {
            id: 2,
            sku: "PROD002",
            name: "Mouse",
            basePrice: 250000,
            costPrice: 150000,
        },
        {
            id: 3,
            sku: "PROD003",
            name: "Keyboard",
            basePrice: 800000,
            costPrice: 500000,
        },
    ];
    res.json({ products: mockProducts, total: 3 });
});
// Mock transactions
app.post("/api/transactions-mock", (req, res) => {
    const { items, discountValue, taxRate, paidAmount } = req.body;
    let subtotal = 0;
    items.forEach((item) => {
        subtotal += item.unitPrice * item.quantity;
    });
    const discount = discountValue || 0;
    const tax = (subtotal - discount) * (taxRate || 0);
    const total = subtotal - discount + tax;
    res.json({
        transactionId: Math.floor(Math.random() * 100000),
        transactionNumber: "TRX-" + Date.now(),
        subtotal: subtotal / 100,
        discount: discount / 100,
        taxAmount: tax / 100,
        totalAmount: total / 100,
        changeAmount: (paidAmount - total) / 100,
    });
});
console.log("✓ Mock API loaded for development");
app.use("/api", routes_1.default);
app.get("/", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/index.html"));
});
app.get("/login", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/login.html"));
});
app.get("/cashier", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/index.html"));
});
app.get("/cashier.html", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/index.html"));
});
app.get("/admin", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/admin.html"));
});
app.get("/admin.html", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/admin.html"));
});
app.get("/inventory", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/inventory.html"));
});
app.get("/reports", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/reports.html"));
});
app.get("/products", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/products.html"));
});
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        error: err.message || "Internal server error",
    });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map