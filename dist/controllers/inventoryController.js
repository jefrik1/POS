"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLowStock = exports.getStockLedger = exports.adjustInventory = exports.getInventory = void 0;
const database_1 = require("../config/database");
const constants_1 = require("../constants");
const mockStore_1 = require("../utils/mockStore");
function getEffectiveOutletId(req) {
    const raw = req.user?.role === "super_admin"
        ? req.query.outletId
        : req.user?.outletId;
    if (!raw)
        return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}
const getInventory = async (req, res) => {
    const outletId = getEffectiveOutletId(req);
    if (!outletId) {
        return res.status(400).json({ error: "Outlet context required" });
    }
    try {
        await (0, database_1.query)(`INSERT INTO inventory (outlet_id, product_id, variant_id, quantity, minimum_stock)
       SELECT $1, p.id, NULL, 0, 10
       FROM products p
       WHERE p.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM inventory i
           WHERE i.outlet_id = $1 AND i.product_id = p.id AND i.variant_id IS NULL
         )`, [outletId]).catch(() => { });
        const { search, limit = 50, offset = 0 } = req.query;
        let sql = `
      SELECT i.id, i.outlet_id, i.product_id, i.variant_id, i.quantity, i.minimum_stock,
             p.sku, p.name, p.base_price, pv.name AS variant_name, pv.price_adjustment
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variants pv ON i.variant_id = pv.id
      WHERE i.outlet_id = $1 AND p.is_active = true
    `;
        const params = [outletId];
        if (search) {
            sql += ` AND (p.name ILIKE $${params.length + 1} OR p.sku ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }
        sql += ` ORDER BY p.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(Number(limit), Number(offset));
        const result = await (0, database_1.query)(sql, params);
        const countResult = await (0, database_1.query)(`SELECT COUNT(*) AS total
       FROM inventory
       WHERE outlet_id = $1
         AND product_id IN (SELECT id FROM products WHERE is_active = true)`, [outletId]);
        res.json({
            inventory: result.rows.map((row) => ({
                id: row.id,
                outletId: row.outlet_id,
                productId: row.product_id,
                variantId: row.variant_id,
                sku: row.sku,
                productName: row.name,
                variantName: row.variant_name,
                quantity: parseInt(row.quantity),
                minimumStock: parseInt(row.minimum_stock),
                basePrice: row.base_price / 100,
            })),
            total: parseInt(countResult.rows[0].total),
        });
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            const { search, limit = 50, offset = 0 } = req.query;
            for (const p of mockStore_1.mockProducts.filter((pp) => pp.is_active)) {
                const exists = mockStore_1.mockInventory.some((i) => i.outlet_id === outletId &&
                    i.product_id === p.id &&
                    i.variant_id == null);
                if (!exists) {
                    mockStore_1.mockInventory.push({
                        id: (0, mockStore_1.nextInventoryId)(),
                        outlet_id: outletId,
                        product_id: p.id,
                        variant_id: null,
                        quantity: 0,
                        minimum_stock: 10,
                        updated_at: new Date().toISOString(),
                    });
                }
            }
            let rows = mockStore_1.mockInventory.filter((i) => i.outlet_id === outletId);
            let joined = rows
                .map((inv) => {
                const p = mockStore_1.mockProducts.find((pp) => pp.id === inv.product_id);
                return {
                    id: inv.id,
                    outlet_id: inv.outlet_id,
                    product_id: inv.product_id,
                    variant_id: inv.variant_id,
                    quantity: inv.quantity,
                    minimum_stock: inv.minimum_stock,
                    sku: p?.sku || "-",
                    name: p?.name || "Produk tidak ditemukan",
                    base_price: p?.base_price || 0,
                    variant_name: null,
                    price_adjustment: 0,
                    is_active: p?.is_active,
                };
            })
                .filter((r) => r.is_active);
            if (search) {
                const s = String(search).toLowerCase();
                joined = joined.filter((r) => r.name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s));
            }
            joined.sort((a, b) => a.name.localeCompare(b.name));
            const total = joined.length;
            const lim = Number(limit);
            const off = Number(offset);
            const sliced = joined.slice(off, off + lim).map((row) => ({
                id: row.id,
                outletId: row.outlet_id,
                productId: row.product_id,
                variantId: row.variant_id,
                sku: row.sku,
                productName: row.name,
                variantName: row.variant_name,
                quantity: Number(row.quantity),
                minimumStock: Number(row.minimum_stock),
                basePrice: row.base_price / 100,
            }));
            return res.json({ inventory: sliced, total });
        }
        console.error("Get inventory error:", error);
        res.status(500).json({ error: "Failed to fetch inventory" });
    }
};
exports.getInventory = getInventory;
const adjustInventory = async (req, res) => {
    try {
        const { outletId, productId, variantId, movementType, quantityChange, notes, } = req.body;
        if (!outletId ||
            !productId ||
            !movementType ||
            quantityChange === undefined ||
            quantityChange === null ||
            String(quantityChange).trim() === "") {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (!Object.values(constants_1.STOCK_MOVEMENT_TYPES).includes(movementType)) {
            return res.status(400).json({ error: "Invalid movement type" });
        }
        const qtyNum = Number(quantityChange);
        if (!Number.isFinite(qtyNum) || qtyNum === 0) {
            return res.status(400).json({ error: "Quantity change tidak valid" });
        }
        const effectiveOutletId = req.user?.role === "super_admin"
            ? Number(outletId)
            : Number(req.user?.outletId || outletId);
        if (!Number.isFinite(effectiveOutletId) || effectiveOutletId <= 0) {
            return res.status(400).json({ error: "Outlet tidak valid" });
        }
        const pidNum = Number(productId);
        if (!Number.isFinite(pidNum) || pidNum <= 0) {
            return res.status(400).json({ error: "Product tidak valid" });
        }
        const variantIdNorm = variantId === "" || variantId === undefined ? null : Number(variantId);
        if (variantIdNorm !== null &&
            (!Number.isFinite(variantIdNorm) || variantIdNorm <= 0)) {
            return res.status(400).json({ error: "Variant tidak valid" });
        }
        try {
            const prodCheck = await (0, database_1.query)("SELECT id FROM products WHERE id = $1 AND is_active = true", [pidNum]);
            if (prodCheck.rows.length === 0) {
                return res.status(404).json({ error: "Produk tidak ditemukan" });
            }
            if (variantIdNorm !== null) {
                const vCheck = await (0, database_1.query)("SELECT id FROM product_variants WHERE id = $1 AND product_id = $2", [variantIdNorm, pidNum]);
                if (vCheck.rows.length === 0) {
                    return res
                        .status(404)
                        .json({ error: "Varian tidak ditemukan untuk produk ini" });
                }
            }
            const client = await database_1.pool.connect();
            try {
                await client.query("BEGIN");
                let inventoryResult = await client.query(`SELECT id, quantity FROM inventory
           WHERE outlet_id = $1 AND product_id = $2 AND variant_id IS NOT DISTINCT FROM $3
           FOR UPDATE`, [effectiveOutletId, pidNum, variantIdNorm]);
                if (inventoryResult.rows.length === 0) {
                    await client.query(`INSERT INTO inventory (outlet_id, product_id, variant_id, quantity, minimum_stock)
             VALUES ($1, $2, $3, 0, 10) ON CONFLICT DO NOTHING`, [effectiveOutletId, pidNum, variantIdNorm]);
                    inventoryResult = await client.query(`SELECT id, quantity FROM inventory
             WHERE outlet_id = $1 AND product_id = $2 AND variant_id IS NOT DISTINCT FROM $3
             FOR UPDATE`, [effectiveOutletId, pidNum, variantIdNorm]);
                }
                if (inventoryResult.rows.length === 0) {
                    await client.query("ROLLBACK");
                    return res.status(404).json({ error: "Inventory item not found" });
                }
                const inventory = inventoryResult.rows[0];
                const newQuantity = parseInt(inventory.quantity) + qtyNum;
                if (newQuantity < 0) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({ error: "Insufficient stock" });
                }
                await client.query(`UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP
           WHERE outlet_id = $2 AND product_id = $3 AND variant_id IS NOT DISTINCT FROM $4`, [newQuantity, effectiveOutletId, pidNum, variantIdNorm]);
                await client.query(`INSERT INTO stock_ledger (outlet_id, product_id, variant_id, movement_type, quantity_change, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                    effectiveOutletId,
                    pidNum,
                    variantIdNorm,
                    movementType,
                    qtyNum,
                    notes || null,
                    req.user.userId,
                ]);
                await client.query("COMMIT");
                return res.json({
                    message: "Inventory adjusted successfully",
                    newQuantity,
                });
            }
            catch (e) {
                try {
                    await client.query("ROLLBACK");
                }
                catch (_) { }
                throw e;
            }
            finally {
                client.release();
            }
        }
        catch (dbErr) {
            if (!(0, mockStore_1.isDbConnectionError)(dbErr))
                throw dbErr;
            const outletIdNum = effectiveOutletId;
            let inv = mockStore_1.mockInventory.find((i) => i.outlet_id === outletIdNum &&
                i.product_id === pidNum &&
                (variantIdNorm !== null
                    ? i.variant_id === variantIdNorm
                    : i.variant_id == null));
            if (!inv) {
                inv = {
                    id: (0, mockStore_1.nextInventoryId)(),
                    outlet_id: outletIdNum,
                    product_id: pidNum,
                    variant_id: variantIdNorm,
                    quantity: 0,
                    minimum_stock: 10,
                    updated_at: new Date().toISOString(),
                };
                mockStore_1.mockInventory.push(inv);
            }
            const newQuantity = Number(inv.quantity) + qtyNum;
            if (newQuantity < 0)
                return res.status(400).json({ error: "Insufficient stock" });
            inv.quantity = newQuantity;
            inv.updated_at = new Date().toISOString();
            const prod = mockStore_1.mockProducts.find((p) => p.id === pidNum);
            mockStore_1.mockLedger.push({
                id: (0, mockStore_1.nextLedgerId)(),
                outlet_id: outletIdNum,
                product_id: pidNum,
                variant_id: variantIdNorm,
                movement_type: movementType,
                quantity_change: qtyNum,
                notes: notes || null,
                created_by: req.user.userId,
                created_at: new Date().toISOString(),
                sku: prod?.sku || "-",
                name: prod?.name || "-",
                username: req.user?.userId ? String(req.user.userId) : "system",
            });
            return res.json({
                message: "Inventory adjusted successfully (mock)",
                newQuantity,
            });
        }
    }
    catch (error) {
        console.error("Adjust inventory error:", error?.code, error?.message, error?.detail, error?.stack);
        res
            .status(500)
            .json({
            error: "Failed to adjust inventory",
            detail: error?.message,
            code: error?.code,
        });
    }
};
exports.adjustInventory = adjustInventory;
const getStockLedger = async (req, res) => {
    const effectiveOutletId = getEffectiveOutletId(req);
    if (!effectiveOutletId)
        return res.status(400).json({ error: "Outlet context required" });
    try {
        const { productId, startDate, endDate, limit = 100, offset = 0, } = req.query;
        let sql = `
      SELECT sl.id, sl.outlet_id, sl.product_id, sl.variant_id, sl.movement_type,
             sl.quantity_change, sl.notes, sl.created_by, sl.created_at,
             p.sku, p.name, u.username
      FROM stock_ledger sl
      JOIN products p ON sl.product_id = p.id
      JOIN users u ON sl.created_by = u.id
      WHERE sl.outlet_id = $1
    `;
        const params = [Number(effectiveOutletId)];
        if (productId) {
            sql += ` AND sl.product_id = $${params.length + 1}`;
            params.push(productId);
        }
        if (startDate) {
            sql += ` AND sl.created_at >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND sl.created_at <= $${params.length + 1}`;
            params.push(endDate);
        }
        sql += ` ORDER BY sl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(Number(limit), Number(offset));
        const result = await (0, database_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            const { productId, startDate, endDate, limit = 100, offset = 0, } = req.query;
            let rows = mockStore_1.mockLedger.filter((l) => l.outlet_id === Number(effectiveOutletId));
            if (productId)
                rows = rows.filter((l) => l.product_id === Number(productId));
            if (startDate)
                rows = rows.filter((l) => new Date(l.created_at) >= new Date(String(startDate)));
            if (endDate)
                rows = rows.filter((l) => new Date(l.created_at) <= new Date(String(endDate)));
            rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return res.json(rows.slice(Number(offset), Number(offset) + Number(limit)));
        }
        console.error("Get stock ledger error:", error);
        res.status(500).json({ error: "Failed to fetch stock ledger" });
    }
};
exports.getStockLedger = getStockLedger;
const checkLowStock = async (req, res) => {
    const effectiveOutletId = getEffectiveOutletId(req);
    if (!effectiveOutletId)
        return res.status(400).json({ error: "Outlet context required" });
    try {
        const result = await (0, database_1.query)(`SELECT i.id, i.product_id, i.quantity, i.minimum_stock, p.sku, p.name
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       WHERE i.outlet_id = $1 AND i.quantity <= i.minimum_stock
       ORDER BY i.quantity ASC`, [Number(effectiveOutletId)]);
        res.json({
            lowStockItems: result.rows.map((row) => ({
                id: row.id,
                productId: row.product_id,
                sku: row.sku,
                name: row.name,
                currentQuantity: parseInt(row.quantity),
                minimumStock: parseInt(row.minimum_stock),
            })),
        });
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            const rows = mockStore_1.mockInventory.filter((i) => i.outlet_id === Number(effectiveOutletId) &&
                Number(i.quantity) <= Number(i.minimum_stock));
            return res.json({
                lowStockItems: rows.map((r) => {
                    const p = mockStore_1.mockProducts.find((pp) => pp.id === r.product_id);
                    return {
                        id: r.id,
                        productId: r.product_id,
                        sku: p?.sku || "-",
                        name: p?.name || "-",
                        currentQuantity: Number(r.quantity),
                        minimumStock: Number(r.minimum_stock),
                    };
                }),
            });
        }
        console.error("Check low stock error:", error);
        res.status(500).json({ error: "Failed to check low stock" });
    }
};
exports.checkLowStock = checkLowStock;
//# sourceMappingURL=inventoryController.js.map