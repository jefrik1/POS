import { Response } from "express";
import { query } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import Decimal from "decimal.js";
import {
  mockProducts,
  mockInventory,
  mockLedger,
  mockTransactions,
  mockTransactionItems,
  isDbConnectionError,
  nextTxnId,
  nextLedgerId,
} from "../utils/mockStore";
const generateTransactionNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TRX-${timestamp}-${random}`;
};
export const createTransaction = async (req: AuthRequest, res: Response) => {
  const {
    outletId,
    items,
    discountType,
    discountValue,
    taxRate,
    paymentMethod,
    paidAmount,
  } = req.body;
  if (
    !outletId ||
    !items ||
    items.length === 0 ||
    !paymentMethod ||
    paidAmount === undefined
  )
    return res.status(400).json({ error: "Missing required fields" });
  const effectiveOutletId = (
    req.user?.role === "super_admin" ? outletId : req.user?.outletId
  ) as number;
  if (!effectiveOutletId)
    return res.status(400).json({ error: "Outlet context required" });
  let client: any = null;
  try {
    client = await (await import("../config/database")).pool.connect();
  } catch (connErr: any) {
    if (!isDbConnectionError(connErr)) throw connErr;
    let subtotal = new Decimal(0);
    const validated: any[] = [];
    for (const item of items) {
      const inv = mockInventory.find(
        (i: any) =>
          i.outlet_id === Number(effectiveOutletId) &&
          i.product_id === Number(item.productId) &&
          (item.variantId
            ? i.variant_id === Number(item.variantId)
            : i.variant_id == null),
      );
      if (!inv)
        return res
          .status(404)
          .json({ error: `Product ${item.productId} not found in inventory` });
      if (Number(inv.quantity) < Number(item.quantity))
        return res
          .status(400)
          .json({ error: `Insufficient stock for product ${item.productId}` });
      const prod = mockProducts.find(
        (p: any) => p.id === Number(item.productId),
      );
      const basePrice = new Decimal(prod ? prod.base_price : 0);
      const priceAdj = new Decimal(0);
      const unitPrice = basePrice.plus(priceAdj);
      const discount = new Decimal(item.discountPerItem || 0).times(100);
      const linePrice = unitPrice.minus(discount).times(item.quantity);
      subtotal = subtotal.plus(linePrice);
      validated.push({
        ...item,
        unitPrice: unitPrice.toNumber(),
        lineTotal: linePrice.toNumber(),
      });
    }
    let discount = new Decimal(0);
    if (discountType === "percentage")
      discount = subtotal.times(Number(discountValue || 0)).dividedBy(100);
    else if (discountType === "nominal")
      discount = new Decimal(Number(discountValue || 0)).times(100);
    const taxAmount = subtotal.minus(discount).times(Number(taxRate || 0));
    const totalAmount = subtotal.minus(discount).plus(taxAmount);
    const changeAmount = new Decimal(Number(paidAmount) * 100).minus(
      totalAmount,
    );
    if (changeAmount.lessThan(0))
      return res
        .status(400)
        .json({ error: "Paid amount is less than total amount" });
    const transactionNumber = generateTransactionNumber();
    const id = nextTxnId();
    const now = new Date().toISOString();
    mockTransactions.push({
      id,
      outlet_id: Number(effectiveOutletId),
      transaction_number: transactionNumber,
      cashier_id: req.user!.userId,
      subtotal: subtotal.toNumber(),
      discount_type: discountType || null,
      discount_value: discount.toNumber(),
      tax_amount: taxAmount.toNumber(),
      total_amount: totalAmount.toNumber(),
      payment_method: paymentMethod,
      paid_amount: Number(paidAmount) * 100,
      change_amount: changeAmount.toNumber(),
      status: "completed",
      created_at: now,
      cashier_name: String(req.user!.userId),
    });
    for (const item of validated) {
      mockTransactionItems.push({
        id: mockTransactionItems.length + 1,
        transaction_id: id,
        product_id: Number(item.productId),
        variant_id: item.variantId || null,
        quantity: Number(item.quantity),
        unit_price: new Decimal(item.unitPrice).toNumber(),
        discount_per_item: new Decimal(item.discountPerItem || 0)
          .times(100)
          .toNumber(),
        line_total: new Decimal(item.lineTotal).toNumber(),
        created_at: now,
      });
      const inv = mockInventory.find(
        (i: any) =>
          i.outlet_id === Number(effectiveOutletId) &&
          i.product_id === Number(item.productId) &&
          (item.variantId
            ? i.variant_id === Number(item.variantId)
            : i.variant_id == null),
      );
      if (inv) inv.quantity = Number(inv.quantity) - Number(item.quantity);
      const prod = mockProducts.find(
        (p: any) => p.id === Number(item.productId),
      );
      mockLedger.push({
        id: nextLedgerId(),
        outlet_id: Number(effectiveOutletId),
        product_id: Number(item.productId),
        variant_id: item.variantId || null,
        movement_type: "stock_out",
        quantity_change: -Number(item.quantity),
        notes: null,
        created_by: req.user!.userId,
        created_at: now,
        sku: prod?.sku || "-",
        name: prod?.name || "-",
        username: String(req.user!.userId),
      });
    }
    return res
      .status(201)
      .json({
        transactionId: id,
        transactionNumber,
        subtotal: subtotal.dividedBy(100).toNumber(),
        discount: discount.dividedBy(100).toNumber(),
        taxAmount: taxAmount.dividedBy(100).toNumber(),
        totalAmount: totalAmount.dividedBy(100).toNumber(),
        paidAmount: Number(paidAmount),
        changeAmount: changeAmount.dividedBy(100).toNumber(),
      });
  }
  try {
    await client.query("BEGIN");
    let subtotal = new Decimal(0);
    const validatedItems: any[] = [];
    for (const item of items) {
      const inventoryResult = await client.query(
        `SELECT i.id, i.quantity, p.base_price, pv.price_adjustment FROM inventory i JOIN products p ON i.product_id = p.id LEFT JOIN product_variants pv ON i.variant_id = pv.id WHERE i.outlet_id = $1 AND i.product_id = $2 AND (i.variant_id = $3 OR ($3 IS NULL AND i.variant_id IS NULL))`,
        [effectiveOutletId, item.productId, item.variantId || null],
      );
      if (inventoryResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: `Product ${item.productId} not found in inventory` });
      }
      const inventory = inventoryResult.rows[0];
      if (parseInt(inventory.quantity) < item.quantity) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: `Insufficient stock for product ${item.productId}` });
      }
      const basePrice = new Decimal(inventory.base_price);
      const priceAdjustment = new Decimal(inventory.price_adjustment || 0);
      const unitPrice = basePrice.plus(priceAdjustment);
      const discount = new Decimal(item.discountPerItem || 0).times(100);
      const linePrice = unitPrice.minus(discount).times(item.quantity);
      subtotal = subtotal.plus(linePrice);
      validatedItems.push({
        ...item,
        unitPrice: unitPrice.toNumber(),
        lineTotal: linePrice.toNumber(),
      });
    }
    let discount = new Decimal(0);
    if (discountType === "percentage")
      discount = subtotal.times(Number(discountValue || 0)).dividedBy(100);
    else if (discountType === "nominal")
      discount = new Decimal(Number(discountValue || 0)).times(100);
    const taxAmount = subtotal.minus(discount).times(Number(taxRate || 0));
    const totalAmount = subtotal.minus(discount).plus(taxAmount);
    const changeAmount = new Decimal(Number(paidAmount) * 100).minus(
      totalAmount,
    );
    if (changeAmount.lessThan(0)) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Paid amount is less than total amount" });
    }
    const transactionNumber = generateTransactionNumber();
    const txnResult = await client.query(
      `INSERT INTO transactions (outlet_id, transaction_number, cashier_id, subtotal, discount_type, discount_value, tax_amount, total_amount, payment_method, paid_amount, change_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        effectiveOutletId,
        transactionNumber,
        req.user!.userId,
        subtotal.toNumber(),
        discountType || null,
        discount.toNumber(),
        taxAmount.toNumber(),
        totalAmount.toNumber(),
        paymentMethod,
        new Decimal(Number(paidAmount) * 100).toNumber(),
        changeAmount.toNumber(),
      ],
    );
    const transactionId = txnResult.rows[0].id;
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, variant_id, quantity, unit_price, discount_per_item, line_total) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          transactionId,
          item.productId,
          item.variantId || null,
          item.quantity,
          new Decimal(item.unitPrice).toNumber(),
          new Decimal(item.discountPerItem || 0).times(100).toNumber(),
          new Decimal(item.lineTotal).toNumber(),
        ],
      );
      await client.query(
        `UPDATE inventory SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE outlet_id = $2 AND product_id = $3 AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))`,
        [
          item.quantity,
          effectiveOutletId,
          item.productId,
          item.variantId || null,
        ],
      );
      await client.query(
        `INSERT INTO stock_ledger (outlet_id, product_id, variant_id, movement_type, quantity_change, reference_type, reference_id, created_by) VALUES ($1,$2,$3,'stock_out',$4,'transaction',$5,$6)`,
        [
          effectiveOutletId,
          item.productId,
          item.variantId || null,
          -item.quantity,
          transactionId,
          req.user!.userId,
        ],
      );
    }
    await client.query("COMMIT");
    res
      .status(201)
      .json({
        transactionId,
        transactionNumber,
        subtotal: subtotal.dividedBy(100).toNumber(),
        discount: discount.dividedBy(100).toNumber(),
        taxAmount: taxAmount.dividedBy(100).toNumber(),
        totalAmount: totalAmount.dividedBy(100).toNumber(),
        paidAmount: Number(paidAmount),
        changeAmount: changeAmount.dividedBy(100).toNumber(),
      });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    try {
      client.release();
    } catch {}
  }
};
export const getTransactions = async (req: AuthRequest, res: Response) => {
  const rawOutletId = (req.query as any).outletId;
  const effectiveOutletId =
    req.user?.role === "super_admin"
      ? rawOutletId
        ? Number(rawOutletId)
        : null
      : (req.user?.outletId as any);
  if (!effectiveOutletId && req.user?.role !== "super_admin")
    return res.status(400).json({ error: "Outlet context required" });
  try {
    const { startDate, endDate, limit = 50, offset = 0 } = req.query as any;
    let sql = `SELECT t.id, t.transaction_number, t.outlet_id, t.cashier_id, t.subtotal, t.discount_value, t.tax_amount, t.total_amount, t.payment_method, t.paid_amount, t.change_amount, t.status, t.created_at, u.username as cashier_name FROM transactions t JOIN users u ON t.cashier_id = u.id WHERE t.status='completed'`;
    const params: any[] = [];
    if (effectiveOutletId) {
      sql += ` AND t.outlet_id = $${params.length + 1}`;
      params.push(Number(effectiveOutletId));
    }
    if (startDate) {
      sql += ` AND t.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND t.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }
    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));
    const result = await query(sql, params);
    res.json(
      result.rows.map((row: any) => ({
        id: row.id,
        transactionNumber: row.transaction_number,
        outletId: row.outlet_id,
        cashierName: row.cashier_name,
        subtotal: row.subtotal / 100,
        discount: row.discount_value / 100,
        taxAmount: row.tax_amount / 100,
        totalAmount: row.total_amount / 100,
        paymentMethod: row.payment_method,
        paidAmount: row.paid_amount / 100,
        changeAmount: row.change_amount / 100,
        status: row.status,
        createdAt: row.created_at,
      })),
    );
  } catch (error: any) {
    if (isDbConnectionError(error)) {
      const { startDate, endDate, limit = 50, offset = 0 } = req.query as any;
      let arr = [...mockTransactions];
      if (effectiveOutletId)
        arr = arr.filter((t: any) => t.outlet_id === Number(effectiveOutletId));
      if (startDate)
        arr = arr.filter(
          (t: any) => new Date(t.created_at) >= new Date(String(startDate)),
        );
      if (endDate)
        arr = arr.filter(
          (t: any) => new Date(t.created_at) <= new Date(String(endDate)),
        );
      arr.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const sliced = arr.slice(Number(offset), Number(offset) + Number(limit));
      return res.json(
        sliced.map((row: any) => ({
          id: row.id,
          transactionNumber: row.transaction_number,
          outletId: row.outlet_id,
          cashierName: row.cashier_name || String(row.cashier_id),
          subtotal: row.subtotal / 100,
          discount: row.discount_value / 100,
          taxAmount: row.tax_amount / 100,
          totalAmount: row.total_amount / 100,
          paymentMethod: row.payment_method,
          paidAmount: row.paid_amount / 100,
          changeAmount: row.change_amount / 100,
          status: row.status,
          createdAt: row.created_at,
        })),
      );
    }
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
};
export const getTransactionDetails = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params as any;
    const txnResult = await query(
      `SELECT t.* FROM transactions t WHERE t.id = $1`,
      [id],
    );
    if (txnResult.rows.length === 0)
      return res.status(404).json({ error: "Transaction not found" });
    const transaction = txnResult.rows[0];
    if (
      req.user?.role !== "super_admin" &&
      transaction.outlet_id !== req.user?.outletId
    )
      return res.status(403).json({ error: "Unauthorized" });
    const itemsResult = await query(
      `SELECT ti.*, p.sku, p.name FROM transaction_items ti JOIN products p ON ti.product_id = p.id WHERE ti.transaction_id = $1`,
      [id],
    );
    res.json({
      ...transaction,
      subtotal: transaction.subtotal / 100,
      discountValue: transaction.discount_value / 100,
      taxAmount: transaction.tax_amount / 100,
      totalAmount: transaction.total_amount / 100,
      paidAmount: transaction.paid_amount / 100,
      changeAmount: transaction.change_amount / 100,
      items: itemsResult.rows.map((row: any) => ({
        ...row,
        unitPrice: row.unit_price / 100,
        discountPerItem: row.discount_per_item / 100,
        lineTotal: row.line_total / 100,
      })),
    });
  } catch (error: any) {
    if (isDbConnectionError(error)) {
      const { id } = req.params as any;
      const txn = mockTransactions.find(
        (t: any) => String(t.id) === String(id),
      );
      if (!txn) return res.status(404).json({ error: "Transaction not found" });
      if (
        req.user?.role !== "super_admin" &&
        txn.outlet_id !== req.user?.outletId
      )
        return res.status(403).json({ error: "Unauthorized" });
      const items = mockTransactionItems
        .filter((it: any) => String(it.transaction_id) === String(id))
        .map((row: any) => {
          const p = mockProducts.find((pp: any) => pp.id === row.product_id);
          return {
            ...row,
            sku: p?.sku || "-",
            name: p?.name || "-",
            unitPrice: row.unit_price / 100,
            discountPerItem: row.discount_per_item / 100,
            lineTotal: row.line_total / 100,
          };
        });
      return res.json({
        ...txn,
        subtotal: txn.subtotal / 100,
        discountValue: txn.discount_value / 100,
        taxAmount: txn.tax_amount / 100,
        totalAmount: txn.total_amount / 100,
        paidAmount: txn.paid_amount / 100,
        changeAmount: txn.change_amount / 100,
        items,
      });
    }
    console.error("Get transaction details error:", error);
    res.status(500).json({ error: "Failed to fetch transaction details" });
  }
};
