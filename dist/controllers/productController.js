"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductVariants = exports.getProducts = exports.createProductVariant = exports.createProduct = void 0;
const database_1 = require("../config/database");
const mockStore_1 = require("../utils/mockStore");
const createProduct = async (req, res) => {
    try {
        const { sku, name, description, categoryId, basePrice, costPrice } = req.body;
        if (!sku ||
            !name ||
            !categoryId ||
            basePrice === undefined ||
            costPrice === undefined) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const categoryIdNum = Number(categoryId);
        if (!Number.isInteger(categoryIdNum) || categoryIdNum <= 0) {
            return res.status(400).json({ error: "Kategori tidak valid" });
        }
        if (![1, 2, 3, 4].includes(categoryIdNum)) {
            return res.status(400).json({ error: "Kategori tidak ditemukan" });
        }
        const bp = Number(basePrice);
        const cp = Number(costPrice);
        if (!Number.isFinite(bp) || !Number.isFinite(cp) || bp <= 0 || cp < 0) {
            return res.status(400).json({ error: "Harga tidak valid" });
        }
        const existingSku = await (0, database_1.query)("SELECT id FROM products WHERE sku = $1", [
            sku,
        ]);
        if (existingSku.rows.length > 0) {
            return res.status(409).json({ error: "SKU already exists" });
        }
        const catCheck = await (0, database_1.query)("SELECT id FROM categories WHERE id = $1", [
            categoryIdNum,
        ]);
        if (catCheck.rows.length === 0) {
            return res.status(400).json({
                error: "Kategori tidak ditemukan. Jalankan: psql -d pos_db -f src/config/schema.sql",
            });
        }
        const result = await (0, database_1.query)(`INSERT INTO products (sku, name, description, category_id, base_price, cost_price)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, sku, name, category_id, base_price, cost_price`, [
            sku,
            name,
            description || null,
            categoryIdNum,
            Math.round(bp * 100),
            Math.round(cp * 100),
        ]);
        const prod = result.rows[0];
        try {
            await (0, database_1.query)(`INSERT INTO inventory (outlet_id, product_id, variant_id, quantity, minimum_stock)
         SELECT o.id, $1, NULL, 0, 10
         FROM outlets o
         WHERE o.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM inventory i
             WHERE i.outlet_id = o.id AND i.product_id = $1 AND i.variant_id IS NULL
           )`, [prod.id]);
        }
        catch (e) {
            console.warn("auto inventory create failed", e);
        }
        res.status(201).json(prod);
    }
    catch (error) {
        if (error?.code === "23505")
            return res.status(409).json({ error: "SKU sudah ada" });
        if (error?.code === "23503") {
            return res
                .status(400)
                .json({ error: "Kategori tidak ditemukan (foreign key violation)" });
        }
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            const { sku, name, description, categoryId, basePrice, costPrice } = req.body;
            if (mockStore_1.mockProducts.some((p) => p.sku === sku)) {
                return res.status(409).json({ error: "SKU sudah ada" });
            }
            const categoryIdNum = Number(categoryId);
            const bp = Number(basePrice);
            const cp = Number(costPrice);
            const newProd = {
                id: (0, mockStore_1.nextProductId)(),
                sku,
                name,
                description: description || null,
                category_id: categoryIdNum,
                base_price: Math.round(bp * 100),
                cost_price: Math.round(cp * 100),
                is_active: true,
            };
            mockStore_1.mockProducts.push(newProd);
            (0, mockStore_1.ensureInventoryForProduct)(newProd.id);
            return res.status(201).json({
                id: newProd.id,
                sku: newProd.sku,
                name: newProd.name,
                category_id: newProd.category_id,
                base_price: newProd.base_price,
                cost_price: newProd.cost_price,
            });
        }
        console.error("Create product error:", error);
        res
            .status(500)
            .json({ error: "Failed to create product", detail: error?.message });
    }
};
exports.createProduct = createProduct;
const createProductVariant = async (req, res) => {
    try {
        const { productId } = req.params;
        const bodyPid = req.body.productId;
        const pid = Number(productId || bodyPid);
        const { sku, name, variantValue, priceAdjustment } = req.body;
        if (!pid || !sku || !name) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const existingSku = await (0, database_1.query)("SELECT id FROM product_variants WHERE sku = $1", [sku]);
        if (existingSku.rows.length > 0) {
            return res.status(409).json({ error: "Variant SKU already exists" });
        }
        const result = await (0, database_1.query)(`INSERT INTO product_variants (product_id, sku, name, variant_value, price_adjustment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, product_id, sku, name, variant_value, price_adjustment`, [
            pid,
            sku,
            name,
            variantValue || null,
            (Number(priceAdjustment) || 0) * 100,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        if (error?.code === "23503")
            return res.status(400).json({ error: "Produk induk tidak ditemukan" });
        if (error?.code === "23505")
            return res.status(409).json({ error: "SKU varian sudah ada" });
        console.error("Create variant error:", error);
        res
            .status(500)
            .json({ error: "Failed to create variant", detail: error?.message });
    }
};
exports.createProductVariant = createProductVariant;
const getProducts = async (req, res) => {
    try {
        const { categoryId, search, limit = 50, offset = 0 } = req.query;
        let sql = `SELECT p.id, p.sku, p.name, p.description, p.category_id, p.base_price, p.cost_price, p.is_active
               FROM products p WHERE p.is_active = true`;
        const params = [];
        if (categoryId) {
            sql += ` AND p.category_id = $${params.length + 1}`;
            params.push(categoryId);
        }
        if (search) {
            sql += ` AND (p.name ILIKE $${params.length + 1} OR p.sku ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }
        sql += ` ORDER BY p.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const result = await (0, database_1.query)(sql, params);
        const countResult = await (0, database_1.query)(`SELECT COUNT(*) AS total FROM products WHERE is_active = true`);
        res.json({
            products: result.rows.map((p) => ({
                ...p,
                basePrice: p.base_price / 100,
                costPrice: p.cost_price / 100,
            })),
            total: parseInt(countResult.rows[0].total),
        });
    }
    catch (error) {
        if ((0, mockStore_1.isDbConnectionError)(error)) {
            let filtered = [...mockStore_1.mockProducts];
            const q = String(req.query.search || "").toLowerCase();
            if (q)
                filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
            const cid = req.query.categoryId
                ? Number(req.query.categoryId)
                : null;
            if (cid)
                filtered = filtered.filter((p) => p.category_id === cid);
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            const lim = Number(req.query.limit || 50);
            const off = Number(req.query.offset || 0);
            const sliced = filtered.slice(off, off + lim);
            return res.json({
                products: sliced.map((p) => ({
                    ...p,
                    basePrice: p.base_price / 100,
                    costPrice: p.cost_price / 100,
                })),
                total: filtered.length,
            });
        }
        console.error("Get products error:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
};
exports.getProducts = getProducts;
const getProductVariants = async (req, res) => {
    try {
        const { productId } = req.params;
        const result = await (0, database_1.query)(`SELECT id, product_id, sku, name, variant_value, price_adjustment, is_active
       FROM product_variants WHERE product_id = $1 AND is_active = true ORDER BY name`, [productId]);
        res.json(result.rows.map((v) => ({
            ...v,
            priceAdjustment: v.price_adjustment / 100,
        })));
    }
    catch (error) {
        console.error("Get variants error:", error);
        res.status(500).json({ error: "Failed to fetch variants" });
    }
};
exports.getProductVariants = getProductVariants;
//# sourceMappingURL=productController.js.map