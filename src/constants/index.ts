export const ROLE_HIERARCHY = {
  super_admin: 3,
  manager: 2,
  cashier: 1,
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
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

export const STOCK_MOVEMENT_TYPES = {
  IN: "stock_in",
  OUT: "stock_out",
  ADJUSTMENT: "adjustment",
  DAMAGE: "damage",
  RETURN: "return",
};

export const TRANSACTION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
  TRANSFER: "transfer",
};
