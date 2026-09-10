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
exports.exportReportCSV = exports.getCashierPerformance = exports.getTopSellingProducts = exports.getSalesSummary = void 0;
const database_1 = require("../config/database");
const mockStore_1 = require("../utils/mockStore");
function periodKey(d, period) {
    if (period === "monthly")
        return d.toISOString().slice(0, 7) + "-01";
    if (period === "weekly") {
        const c = new Date(d);
        const day = c.getDay();
        const diff = c.getDate() - day + (day === 0 ? -6 : 1);
        c.setDate(diff);
        c.setHours(0, 0, 0, 0);
        return c.toISOString().slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
}
const getSalesSummary = async (req, res) => {
    const { outletId, period = "daily", startDate, endDate } = req.query;
    const effectiveOutletId = req.user?.role === "super_admin"
        ? outletId
            ? Number(outletId)
            : null
        : req.user?.outletId;
    try {
        let groupByClause = "DATE(t.created_at)";
        if (period === "weekly")
            groupByClause = "DATE_TRUNC('week', t.created_at)";
        else if (period === "monthly")
            groupByClause = "DATE_TRUNC('month', t.created_at)";
        let sql = `SELECT ${groupByClause} as period, COUNT(t.id) as transaction_count, SUM(t.subtotal) as total_subtotal, SUM(t.discount_value) as total_discount, SUM(t.tax_amount) as total_tax, SUM(t.total_amount) as total_revenue FROM transactions t WHERE t.status = 'completed'`;
        const params = [];
        if (effectiveOutletId) {
            sql += ` AND t.outlet_id = $${params.length + 1}`;
            params.push(effectiveOutletId);
        }
        if (startDate) {
            sql += ` AND t.created_at >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND t.created_at <= $${params.length + 1}`;
            params.push(endDate);
        }
        sql += ` GROUP BY ${groupByClause} ORDER BY period DESC`;
        const result = await (0, database_1.query)(sql, params);
        res.json({
            summary: result.rows.map((row) => ({
                period: row.period,
                transactionCount: parseInt(row.transaction_count),
                totalSubtotal: Number(row.total_subtotal || 0) / 100,
                totalDiscount: Number(row.total_discount || 0) / 100,
                totalTax: Number(row.total_tax || 0) / 100,
                totalRevenue: Number(row.total_revenue || 0) / 100,
            })),
        });
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            let arr = mockStore_1.mockTransactions.filter((t) => t.status === "completed");
            if (effectiveOutletId)
                arr = arr.filter((t) => t.outlet_id === Number(effectiveOutletId));
            if (startDate)
                arr = arr.filter((t) => new Date(t.created_at) >= new Date(String(startDate)));
            if (endDate)
                arr = arr.filter((t) => new Date(t.created_at) <= new Date(String(endDate)));
            const map = new Map();
            for (const t of arr) {
                const k = periodKey(new Date(t.created_at), String(period));
                if (!map.has(k))
                    map.set(k, {
                        period: k,
                        transactionCount: 0,
                        totalSubtotal: 0,
                        totalDiscount: 0,
                        totalTax: 0,
                        totalRevenue: 0,
                    });
                const g = map.get(k);
                g.transactionCount++;
                g.totalSubtotal += Number(t.subtotal || 0) / 100;
                g.totalDiscount += Number(t.discount_value || 0) / 100;
                g.totalTax += Number(t.tax_amount || 0) / 100;
                g.totalRevenue += Number(t.total_amount || 0) / 100;
            }
            const summary = [...map.values()].sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime());
            return res.json({ summary });
        }
        console.error("Get sales summary error:", error);
        res.status(500).json({ error: "Failed to fetch sales summary" });
    }
};
exports.getSalesSummary = getSalesSummary;
const getTopSellingProducts = async (req, res) => {
    const { outletId, limit = 10, startDate, endDate } = req.query;
    const effectiveOutletId = req.user?.role === "super_admin"
        ? outletId
            ? Number(outletId)
            : null
        : req.user?.outletId;
    try {
        let sql = `SELECT p.id, p.sku, p.name, SUM(ti.quantity) as total_quantity, SUM(ti.line_total) as total_revenue, AVG(ti.unit_price) as avg_price FROM transaction_items ti JOIN products p ON ti.product_id = p.id JOIN transactions t ON ti.transaction_id = t.id WHERE t.status = 'completed'`;
        const params = [];
        if (effectiveOutletId) {
            sql += ` AND t.outlet_id = $${params.length + 1}`;
            params.push(effectiveOutletId);
        }
        if (startDate) {
            sql += ` AND t.created_at >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND t.created_at <= $${params.length + 1}`;
            params.push(endDate);
        }
        sql += ` GROUP BY p.id, p.sku, p.name ORDER BY total_quantity DESC LIMIT $${params.length + 1}`;
        params.push(Number(limit));
        const result = await (0, database_1.query)(sql, params);
        res.json({
            topProducts: result.rows.map((row) => ({
                productId: row.id,
                sku: row.sku,
                name: row.name,
                totalQuantity: parseInt(row.total_quantity),
                totalRevenue: Number(row.total_revenue) / 100,
                averagePrice: Number(row.avg_price) / 100,
            })),
        });
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            let txns = mockStore_1.mockTransactions.filter((t) => t.status === "completed");
            if (effectiveOutletId)
                txns = txns.filter((t) => t.outlet_id === Number(effectiveOutletId));
            if (startDate)
                txns = txns.filter((t) => new Date(t.created_at) >= new Date(String(startDate)));
            if (endDate)
                txns = txns.filter((t) => new Date(t.created_at) <= new Date(String(endDate)));
            const ids = new Set(txns.map((t) => t.id));
            const map = new Map();
            for (const it of mockStore_1.mockTransactionItems.filter((it) => ids.has(it.transaction_id))) {
                const p = mockStore_1.mockProducts.find((pp) => pp.id === it.product_id);
                if (!map.has(it.product_id))
                    map.set(it.product_id, {
                        productId: it.product_id,
                        sku: p?.sku || "-",
                        name: p?.name || "-",
                        totalQuantity: 0,
                        totalRevenue: 0,
                        totalUnit: 0,
                        cnt: 0,
                    });
                const g = map.get(it.product_id);
                g.totalQuantity += Number(it.quantity);
                g.totalRevenue += Number(it.line_total) / 100;
                g.totalUnit += Number(it.unit_price);
                g.cnt++;
            }
            let arr = [...map.values()]
                .map((v) => ({
                productId: v.productId,
                sku: v.sku,
                name: v.name,
                totalQuantity: v.totalQuantity,
                totalRevenue: v.totalRevenue,
                averagePrice: v.cnt ? v.totalUnit / v.cnt / 100 : 0,
            }))
                .sort((a, b) => b.totalQuantity - a.totalQuantity)
                .slice(0, Number(limit));
            return res.json({ topProducts: arr });
        }
        console.error("Get top selling products error:", error);
        res.status(500).json({ error: "Failed to fetch top selling products" });
    }
};
exports.getTopSellingProducts = getTopSellingProducts;
const getCashierPerformance = async (req, res) => {
    const { outletId, startDate, endDate, limit = 20 } = req.query;
    const effectiveOutletId = req.user?.role === "super_admin"
        ? outletId
            ? Number(outletId)
            : null
        : req.user?.outletId;
    try {
        let sql = `SELECT u.id, u.username, COUNT(t.id) as transaction_count, SUM(t.total_amount) as total_revenue, AVG(t.total_amount) as avg_transaction_value, SUM(t.discount_value) as total_discount FROM transactions t JOIN users u ON t.cashier_id = u.id WHERE t.status = 'completed'`;
        const params = [];
        if (effectiveOutletId) {
            sql += ` AND t.outlet_id = $${params.length + 1}`;
            params.push(effectiveOutletId);
        }
        if (startDate) {
            sql += ` AND t.created_at >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND t.created_at <= $${params.length + 1}`;
            params.push(endDate);
        }
        sql += ` GROUP BY u.id, u.username ORDER BY total_revenue DESC LIMIT $${params.length + 1}`;
        params.push(Number(limit));
        const result = await (0, database_1.query)(sql, params);
        res.json({
            cashierPerformance: result.rows.map((row) => ({
                cashierId: row.id,
                cashierName: row.username,
                transactionCount: parseInt(row.transaction_count),
                totalRevenue: Number(row.total_revenue) / 100,
                averageTransactionValue: Number(row.avg_transaction_value) / 100,
                totalDiscount: Number(row.total_discount) / 100,
            })),
        });
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            let txns = mockStore_1.mockTransactions.filter((t) => t.status === "completed");
            if (effectiveOutletId)
                txns = txns.filter((t) => t.outlet_id === Number(effectiveOutletId));
            if (startDate)
                txns = txns.filter((t) => new Date(t.created_at) >= new Date(String(startDate)));
            if (endDate)
                txns = txns.filter((t) => new Date(t.created_at) <= new Date(String(endDate)));
            const map = new Map();
            for (const t of txns) {
                if (!map.has(t.cashier_id))
                    map.set(t.cashier_id, {
                        cashierId: t.cashier_id,
                        cashierName: String(t.cashier_name || t.cashier_id),
                        transactionCount: 0,
                        totalRevenue: 0,
                        totalDiscount: 0,
                    });
                const g = map.get(t.cashier_id);
                g.transactionCount++;
                g.totalRevenue += Number(t.total_amount) / 100;
                g.totalDiscount += Number(t.discount_value) / 100;
            }
            let arr = [...map.values()]
                .map((v) => ({
                ...v,
                averageTransactionValue: v.transactionCount
                    ? v.totalRevenue / v.transactionCount
                    : 0,
            }))
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, Number(limit));
            return res.json({ cashierPerformance: arr });
        }
        console.error("Get cashier performance error:", error);
        res.status(500).json({ error: "Failed to fetch cashier performance" });
    }
};
exports.getCashierPerformance = getCashierPerformance;
const exportReportCSV = async (req, res) => {
    const { outletId, reportType = "sales", startDate, endDate, } = req.query;
    const effectiveOutletId = req.user?.role === "super_admin"
        ? outletId
            ? Number(outletId)
            : null
        : req.user?.outletId;
    try {
        let sql = "";
        let params = [];
        if (reportType === "sales") {
            sql = `SELECT t.transaction_number, t.created_at, u.username as cashier, t.subtotal / 100 as subtotal, t.discount_value / 100 as discount, t.tax_amount / 100 as tax, t.total_amount / 100 as total, t.payment_method FROM transactions t JOIN users u ON t.cashier_id = u.id WHERE t.status = 'completed'`;
            if (effectiveOutletId) {
                sql += ` AND t.outlet_id = $${params.length + 1}`;
                params.push(effectiveOutletId);
            }
        }
        else if (reportType === "inventory") {
            sql = `SELECT p.sku, p.name, i.quantity, i.minimum_stock, p.base_price / 100 as price FROM inventory i JOIN products p ON i.product_id = p.id WHERE 1=1`;
            if (effectiveOutletId) {
                sql += ` AND i.outlet_id = $${params.length + 1}`;
                params.push(effectiveOutletId);
            }
        }
        if (startDate && reportType === "sales") {
            sql += ` AND t.created_at >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate && reportType === "sales") {
            sql += ` AND t.created_at <= $${params.length + 1}`;
            params.push(endDate);
        }
        sql += ` ORDER BY created_at DESC`;
        const result = await (0, database_1.query)(sql, params);
        if (result.rows.length === 0) {
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=report-${Date.now()}.csv`);
            return res.send("");
        }
        const headers = Object.keys(result.rows[0]);
        const csvContent = [
            headers.join(","),
            ...result.rows.map((row) => headers
                .map((header) => {
                const value = row[header];
                if (typeof value === "string" && value.includes(","))
                    return `"${value}"`;
                return value;
            })
                .join(",")),
        ].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=report-${Date.now()}.csv`);
        res.send(csvContent);
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            let csv = "";
            if (reportType === "sales") {
                let txns = mockStore_1.mockTransactions.filter((t) => t.status === "completed");
                if (effectiveOutletId)
                    txns = txns.filter((t) => t.outlet_id === Number(effectiveOutletId));
                if (startDate)
                    txns = txns.filter((t) => new Date(t.created_at) >= new Date(String(startDate)));
                if (endDate)
                    txns = txns.filter((t) => new Date(t.created_at) <= new Date(String(endDate)));
                const headers = [
                    "transaction_number",
                    "created_at",
                    "cashier",
                    "subtotal",
                    "discount",
                    "tax",
                    "total",
                    "payment_method",
                ];
                const rows = txns.map((t) => [
                    t.transaction_number,
                    t.created_at,
                    t.cashier_name || t.cashier_id,
                    t.subtotal / 100,
                    t.discount_value / 100,
                    t.tax_amount / 100,
                    t.total_amount / 100,
                    t.payment_method,
                ]);
                csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            }
            else {
                const { mockInventory } = await Promise.resolve().then(() => __importStar(require("../utils/mockStore")));
                let inv = mockInventory;
                if (effectiveOutletId)
                    inv = inv.filter((i) => i.outlet_id === Number(effectiveOutletId));
                const headers = ["sku", "name", "quantity", "minimum_stock", "price"];
                const rows = inv.map((i) => {
                    const p = mockStore_1.mockProducts.find((pp) => pp.id === i.product_id);
                    return [
                        p?.sku || "-",
                        p?.name || "-",
                        i.quantity,
                        i.minimum_stock,
                        (p?.base_price || 0) / 100,
                    ];
                });
                csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            }
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=report-${Date.now()}.csv`);
            return res.send(csv);
        }
        console.error("Export report error:", error);
        res.status(500).json({ error: "Failed to export report" });
    }
};
exports.exportReportCSV = exportReportCSV;
//# sourceMappingURL=reportController.js.map