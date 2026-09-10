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
const auth_1 = require("../middleware/auth");
const authController = __importStar(require("../controllers/authController"));
const productController = __importStar(require("../controllers/productController"));
const outletController = __importStar(require("../controllers/outletController"));
const inventoryController = __importStar(require("../controllers/inventoryController"));
const transactionController = __importStar(require("../controllers/transactionController"));
const reportController = __importStar(require("../controllers/reportController"));
const userController = __importStar(require("../controllers/userController"));
const router = express_1.default.Router();
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.post("/auth/refresh", authController.refreshAccessToken);
router.post("/auth/logout", auth_1.authMiddleware, authController.logout);
router.post("/products", auth_1.authMiddleware, (0, auth_1.requireRole)("super_admin", "manager"), productController.createProduct);
router.get("/products", auth_1.authMiddleware, productController.getProducts);
router.post("/products/:productId/variants", auth_1.authMiddleware, (0, auth_1.requireRole)("super_admin", "manager"), productController.createProductVariant);
router.get("/products/:productId/variants", auth_1.authMiddleware, productController.getProductVariants);
router.get("/outlets", auth_1.authMiddleware, outletController.getOutlets);
router.post("/outlets", auth_1.authMiddleware, (0, auth_1.requirePermission)("manage_outlets"), outletController.createOutlet);
router.delete("/outlets/:id", auth_1.authMiddleware, (0, auth_1.requirePermission)("manage_outlets"), outletController.deleteOutlet);
router.get("/users", auth_1.authMiddleware, userController.getUsers);
router.get("/dashboard/summary", auth_1.authMiddleware, outletController.getDashboardSummary);
router.get("/inventory", auth_1.authMiddleware, auth_1.requireOutletContext, inventoryController.getInventory);
router.post("/inventory/adjust", auth_1.authMiddleware, auth_1.requireOutletContext, (0, auth_1.requirePermission)("manage_inventory"), inventoryController.adjustInventory);
router.get("/inventory/stock-ledger", auth_1.authMiddleware, auth_1.requireOutletContext, inventoryController.getStockLedger);
router.get("/inventory/low-stock", auth_1.authMiddleware, auth_1.requireOutletContext, inventoryController.checkLowStock);
router.post("/transactions", auth_1.authMiddleware, auth_1.requireOutletContext, (0, auth_1.requirePermission)("process_transactions"), transactionController.createTransaction);
router.get("/transactions", auth_1.authMiddleware, auth_1.requireOutletContext, transactionController.getTransactions);
router.get("/transactions/:id", auth_1.authMiddleware, transactionController.getTransactionDetails);
router.get("/reports/sales-summary", auth_1.authMiddleware, auth_1.requireOutletContext, (0, auth_1.requirePermission)("view_reports"), reportController.getSalesSummary);
router.get("/reports/top-selling", auth_1.authMiddleware, auth_1.requireOutletContext, (0, auth_1.requirePermission)("view_reports"), reportController.getTopSellingProducts);
router.get("/reports/cashier-performance", auth_1.authMiddleware, auth_1.requireOutletContext, (0, auth_1.requirePermission)("view_reports"), reportController.getCashierPerformance);
router.get("/reports/export", auth_1.authMiddleware, auth_1.requireOutletContext, (0, auth_1.requirePermission)("view_reports"), reportController.exportReportCSV);
exports.default = router;
//# sourceMappingURL=index.js.map