"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_METHODS = exports.TRANSACTION_STATUS = exports.STOCK_MOVEMENT_TYPES = exports.ROLE_PERMISSIONS = exports.ROLE_HIERARCHY = void 0;
exports.ROLE_HIERARCHY = {
    super_admin: 3,
    manager: 2,
    cashier: 1,
};
exports.ROLE_PERMISSIONS = {
    super_admin: [
        "manage_users",
        "manage_outlets",
        "manage_products",
        "manage_inventory",
        "view_reports",
        "access_all_outlets",
        "process_transactions",
        "manage_stock_ledger",
    ],
    manager: [
        "manage_inventory",
        "view_reports",
        "process_transactions",
        "manage_stock_ledger",
    ],
    cashier: ["process_transactions", "view_own_transactions"],
};
exports.STOCK_MOVEMENT_TYPES = {
    IN: "stock_in",
    OUT: "stock_out",
    ADJUSTMENT: "adjustment",
    DAMAGE: "damage",
    RETURN: "return",
};
exports.TRANSACTION_STATUS = {
    PENDING: "pending",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
};
exports.PAYMENT_METHODS = {
    CASH: "cash",
    CARD: "card",
    TRANSFER: "transfer",
};
//# sourceMappingURL=index.js.map