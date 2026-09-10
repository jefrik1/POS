import express from "express";
import {
  authMiddleware,
  requireRole,
  requirePermission,
  requireOutletContext,
} from "../middleware/auth";
import * as authController from "../controllers/authController";
import * as productController from "../controllers/productController";
import * as outletController from "../controllers/outletController";
import * as inventoryController from "../controllers/inventoryController";
import * as transactionController from "../controllers/transactionController";
import * as reportController from "../controllers/reportController";
import * as userController from "../controllers/userController";

const router = express.Router();

router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.post("/auth/refresh", authController.refreshAccessToken);
router.post("/auth/logout", authMiddleware, authController.logout);

router.post(
  "/products",
  authMiddleware,
  requireRole("super_admin", "manager"),
  productController.createProduct,
);
router.get("/products", authMiddleware, productController.getProducts);
router.post(
  "/products/:productId/variants",
  authMiddleware,
  requireRole("super_admin", "manager"),
  productController.createProductVariant,
);
router.get(
  "/products/:productId/variants",
  authMiddleware,
  productController.getProductVariants,
);

router.get("/outlets", authMiddleware, outletController.getOutlets);
router.post(
  "/outlets",
  authMiddleware,
  requirePermission("manage_outlets"),
  outletController.createOutlet,
);
router.delete(
  "/outlets/:id",
  authMiddleware,
  requirePermission("manage_outlets"),
  outletController.deleteOutlet,
);
router.get("/users", authMiddleware, userController.getUsers);
router.get(
  "/dashboard/summary",
  authMiddleware,
  outletController.getDashboardSummary,
);

router.get(
  "/inventory",
  authMiddleware,
  requireOutletContext,
  inventoryController.getInventory,
);
router.post(
  "/inventory/adjust",
  authMiddleware,
  requireOutletContext,
  requirePermission("manage_inventory"),
  inventoryController.adjustInventory,
);
router.get(
  "/inventory/stock-ledger",
  authMiddleware,
  requireOutletContext,
  inventoryController.getStockLedger,
);
router.get(
  "/inventory/low-stock",
  authMiddleware,
  requireOutletContext,
  inventoryController.checkLowStock,
);

router.post(
  "/transactions",
  authMiddleware,
  requireOutletContext,
  requirePermission("process_transactions"),
  transactionController.createTransaction,
);
router.get(
  "/transactions",
  authMiddleware,
  requireOutletContext,
  transactionController.getTransactions,
);
router.get(
  "/transactions/:id",
  authMiddleware,
  transactionController.getTransactionDetails,
);

router.get(
  "/reports/sales-summary",
  authMiddleware,
  requireOutletContext,
  requirePermission("view_reports"),
  reportController.getSalesSummary,
);
router.get(
  "/reports/top-selling",
  authMiddleware,
  requireOutletContext,
  requirePermission("view_reports"),
  reportController.getTopSellingProducts,
);
router.get(
  "/reports/cashier-performance",
  authMiddleware,
  requireOutletContext,
  requirePermission("view_reports"),
  reportController.getCashierPerformance,
);
router.get(
  "/reports/export",
  authMiddleware,
  requireOutletContext,
  requirePermission("view_reports"),
  reportController.exportReportCSV,
);

export default router;
