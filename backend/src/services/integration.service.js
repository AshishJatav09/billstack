const crypto = require("crypto");
const mongoose = require("mongoose");

const Business = require("../models/Business");
const Customer = require("../models/Customer");
const CustomerLedger = require("../models/CustomerLedger");
const IntegrationCredential = require("../models/IntegrationCredential");
const IntegrationEvent = require("../models/IntegrationEvent");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const AppError = require("../utils/appError");
const { buildGstSnapshot, validateGstin, validateStateCode } = require("../utils/gst");
const { buildInvoiceNumber, buildInvoiceTotals } = require("../utils/invoice");
const { toMinorUnits, fromMinorUnits } = require("../utils/money");
const { sendInvoiceMessage } = require("./communication.service");
const { allocatePayment, createPayment } = require("./payment.service");
const { ensureBusinessSubscription, getPlanEntitlements, isSubscriptionAccessible } = require("../utils/subscription");
const { buildInventoryFlags } = require("./inventory.service");

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const hashValue = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const generateApiKey = () => {
  const prefix = crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(24).toString("hex");
  return { keyPrefix: prefix, rawKey: `bs_live_${prefix}_${secret}`, keyHash: hashValue(`${prefix}:${secret}`) };
};

const splitApiKey = (rawKey = "") => {
  const match = String(rawKey).match(/^bs_live_([a-f0-9]{8})_([a-f0-9]{48})$/i);
  if (!match) throw new AppError("Invalid integration API key", 401);
  return { keyPrefix: match[1], secret: match[2] };
};

const authenticateIntegrationKey = async (rawKey) => {
  const { keyPrefix, secret } = splitApiKey(rawKey);
  const credential = await IntegrationCredential.findOne({ keyPrefix, status: "ACTIVE" });
  if (!credential) throw new AppError("Invalid integration API key", 401);
  const expected = Buffer.from(credential.keyHash, "hex");
  const actual = Buffer.from(hashValue(`${keyPrefix}:${secret}`), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new AppError("Invalid integration API key", 401);
  }
  credential.lastUsedAt = new Date();
  await credential.save();
  return credential;
};

const createCredential = async ({ businessId, name, source, userId }) => {
  const key = generateApiKey();
  const credential = await IntegrationCredential.create({
    businessId,
    name,
    source: source || "API",
    keyPrefix: key.keyPrefix,
    keyHash: key.keyHash,
    createdBy: userId,
  });
  return { credential, rawKey: key.rawKey };
};

const revokeCredential = async ({ businessId, credentialId, userId }) => {
  const credential = await IntegrationCredential.findOne({ _id: credentialId, businessId });
  if (!credential) throw new AppError("Integration credential not found", 404);
  credential.status = "REVOKED";
  credential.revokedAt = new Date();
  credential.revokedBy = userId;
  await credential.save();
  return credential;
};

const listCredentials = ({ businessId }) =>
  IntegrationCredential.find({ businessId }).select("-keyHash").sort("-createdAt");

const getOrCreateIntegrationProduct = async ({ businessId, item, session }) => {
  const sku = String(item.sku || item.externalProductId || "").trim().toUpperCase();
  const query = sku ? { businessId, sku } : { businessId, name: item.name };
  return Product.findOneAndUpdate(
    query,
    {
      $setOnInsert: {
        businessId,
        name: item.name,
        sku,
        sellingPrice: Number(item.rate || item.amount || 0),
        taxRate: Number(item.taxRate || 0),
        hsnSac: item.hsnSac || "",
        gstClassification: item.gstClassification || "",
        trackInventory: false,
        status: "active",
      },
    },
    { upsert: true, new: true, session }
  );
};

const normalizeOrderPayload = (payload = {}) => {
  if (!payload.externalOrderId) throw new AppError("externalOrderId is required", 400);
  if (!payload.customer?.name && !payload.customer?.email && !payload.customer?.phone) {
    throw new AppError("Customer identity is required", 400);
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new AppError("At least one purchased item is required", 400);
  }
  return {
    externalOrderId: String(payload.externalOrderId),
    source: String(payload.source || "API").toUpperCase(),
    customer: payload.customer,
    items: payload.items,
    payment: payload.payment || {},
    sendInvoice: payload.communication?.sendInvoice === true,
  };
};

const applyIntegrationInvoiceStock = async ({ business, businessId, invoiceId, lineItems, createdBy, session }) => {
  const productIds = [...new Set(lineItems.map((item) => item.productId.toString()))];
  const products = await Product.find({ _id: { $in: productIds }, businessId }).session(session);
  const map = new Map(products.map((product) => [product._id.toString(), product]));
  for (const item of lineItems) {
    const product = map.get(item.productId.toString());
    if (!product || !product.trackInventory) continue;
    const previousStock = product.currentStock;
    const newStock = previousStock - Number(item.quantity || 0);
    if (!business.inventorySettings?.allowNegativeStock && newStock < 0) throw new AppError(`Insufficient stock for ${product.name}`, 403);
    product.currentStock = newStock;
    Object.assign(product, buildInventoryFlags(product));
    await product.save({ session });
    await StockMovement.create(
      [{ businessId, productId: product._id, type: "OUT", quantity: Number(item.quantity || 0), previousStock, newStock, reason: `External order invoice ${invoiceId}`, referenceType: "INVOICE", referenceId: invoiceId.toString(), createdBy }],
      { session }
    );
  }
};

const ingestExternalOrder = async ({ credential, payload }) => {
  const normalized = normalizeOrderPayload(payload);
  const payloadHash = hashValue(stableStringify(normalized));
  const existing = await IntegrationEvent.findOne({
    businessId: credential.businessId,
    source: normalized.source,
    externalOrderId: normalized.externalOrderId,
  });
  if (existing) {
    if (existing.payloadHash === payloadHash && existing.status === "PROCESSED") return { event: existing, idempotent: true };
    existing.status = "CONFLICT";
    existing.errorMessage = "Conflicting duplicate external order payload";
    await existing.save();
    throw new AppError("Conflicting duplicate external order payload", 409);
  }

  const session = await mongoose.startSession();
  let event;
  let pendingConfirmedPayment = null;
  try {
    await session.withTransaction(async () => {
      const business = await Business.findById(credential.businessId).session(session);
      if (!business) throw new AppError("Business not found", 404);
      const subscription = await ensureBusinessSubscription({ businessId: business._id, planCode: business.planCode, session });
      if (!isSubscriptionAccessible(subscription)) throw new AppError("Your subscription is inactive or expired", 402);
      const plan = getPlanEntitlements(subscription);
      const currentMonthKey = new Date().toISOString().slice(0, 7);
      const invoiceCount = await Invoice.countDocuments({ businessId: business._id, status: { $ne: "cancelled" }, invoiceDate: { $gte: new Date(`${currentMonthKey}-01T00:00:00.000Z`) } }).session(session);
      if (invoiceCount >= plan.invoiceMonthlyLimit) throw new AppError(`Invoice limit reached for the ${plan.name} plan. Monthly limit: ${plan.invoiceMonthlyLimit}`, 403);
      [event] = await IntegrationEvent.create(
        [{
          businessId: credential.businessId,
          credentialId: credential._id,
          source: normalized.source,
          externalOrderId: normalized.externalOrderId,
          payloadHash,
          status: "PROCESSING",
          metadata: { paymentStatus: normalized.payment.status || "UNCONFIRMED" },
        }],
        { session }
      );
      const customerQuery = normalized.customer.email
        ? { businessId: credential.businessId, email: String(normalized.customer.email).toLowerCase() }
        : { businessId: credential.businessId, phone: normalized.customer.phone };
      const customer = await Customer.findOneAndUpdate(
        customerQuery,
        {
          $set: {
            name: normalized.customer.name || normalized.customer.email || normalized.customer.phone,
            phone: normalized.customer.phone || "",
            billingAddress: normalized.customer.address || normalized.customer.billingAddress || "",
            gstNumber: normalized.customer.gstNumber || "",
            stateCode: normalized.customer.stateCode || "",
          },
          $setOnInsert: { businessId: credential.businessId, email: normalized.customer.email || "" },
        },
        { upsert: true, new: true, session }
      );
      const products = [];
      for (const item of normalized.items) products.push(await getOrCreateIntegrationProduct({ businessId: credential.businessId, item, session }));
      const lineItems = normalized.items.map((item, index) => ({
        productId: products[index]._id,
        productName: products[index].name,
        quantity: Number(item.quantity || 1),
        rate: Number(item.rate ?? item.amount ?? 0),
        taxRate: Number(item.taxRate || 0),
        discountType: item.discountType === "amount" ? "amount" : "percent",
        discountValue: Number(item.discountValue || 0),
      }));
      const totals = buildInvoiceTotals({ lineItems, amountPaid: 0 });
      if (business.gstConfiguration?.enabled) {
        if (!validateGstin(business.gstConfiguration.gstin || business.gstTaxId) || !validateStateCode(business.gstConfiguration.stateCode)) throw new AppError("Invalid business GST configuration", 400);
        if (customer.gstNumber && !validateGstin(customer.gstNumber)) throw new AppError("Invalid customer GSTIN", 400);
      }
      const gstSnapshot = business.gstConfiguration?.enabled
        ? buildGstSnapshot({ business, counterparty: customer, lineItems: totals.lineItems, products, placeOfSupplyCode: normalized.customer.placeOfSupplyCode || normalized.customer.stateCode })
        : null;
      const sequence = business.invoiceNumbering?.nextSequence || 1;
      const invoiceDate = normalized.payment.paidAt ? new Date(normalized.payment.paidAt) : new Date();
      const [invoice] = await Invoice.create(
        [{
          businessId: credential.businessId,
          customerId: customer._id,
          invoiceNumber: buildInvoiceNumber({ prefix: business.invoiceNumbering?.prefix, format: business.invoiceNumbering?.format, sequence, date: invoiceDate }),
          invoiceDate,
          dueDate: invoiceDate,
          customerDetails: { name: customer.name, email: customer.email, phone: customer.phone, address: customer.billingAddress, gstNumber: customer.gstNumber },
          businessDetails: { name: business.name, email: business.email || business.billingEmail, phone: business.phone, address: business.address, gstNumber: business.gstTaxId },
          lineItems: totals.lineItems,
          subtotal: totals.subtotal,
          totalTax: totals.totalTax,
          totalDiscount: totals.totalDiscount,
          gstSnapshot,
          gstBreakup: gstSnapshot ? { cgst: gstSnapshot.cgst, sgst: gstSnapshot.sgst, utgst: gstSnapshot.utgst, igst: gstSnapshot.igst, taxableValue: gstSnapshot.taxableValue, hsnSacSummary: gstSnapshot.hsnSacSummary } : undefined,
          grandTotal: totals.grandTotal,
          amountPaid: 0,
          balanceDue: totals.grandTotal,
          paymentStatus: "unpaid",
          notes: `Imported from ${normalized.source}: ${normalized.externalOrderId}`,
          createdBy: credential.createdBy,
        }],
        { session }
      );
      await CustomerLedger.updateOne({ businessId: credential.businessId, sourceKey: `INVOICE:${invoice._id}:DEBIT` }, { $setOnInsert: { businessId: credential.businessId, customerId: customer._id, eventType: "INVOICE", amount: invoice.grandTotal, direction: "DEBIT", invoiceId: invoice._id, sourceKey: `INVOICE:${invoice._id}:DEBIT`, createdBy: credential.createdBy } }, { upsert: true, session });
      await applyIntegrationInvoiceStock({ business, businessId: credential.businessId, invoiceId: invoice._id, lineItems: totals.lineItems, createdBy: credential.createdBy, session });
      business.invoiceNumbering.nextSequence = sequence + 1;
      await business.save({ session });
      event.customerId = customer._id;
      event.invoiceId = invoice._id;
      if (String(normalized.payment.status || "").toUpperCase() === "CONFIRMED") {
        const amount = fromMinorUnits(toMinorUnits(normalized.payment.amount ?? totals.grandTotal));
        if (toMinorUnits(amount) > toMinorUnits(totals.grandTotal)) throw new AppError("Confirmed payment exceeds invoice amount", 400);
        pendingConfirmedPayment = { amount, invoiceId: invoice._id, customerId: customer._id };
      }
      event.status = pendingConfirmedPayment ? "PROCESSING" : "PROCESSED";
      await event.save({ session });
    });
  } catch (error) {
    if (event?._id) {
      await IntegrationEvent.updateOne({ _id: event._id }, { status: "FAILED", errorMessage: error.message });
    }
    throw error;
  } finally {
    session.endSession();
  }
  if (pendingConfirmedPayment) {
    const payment = await createPayment({
      businessId: credential.businessId,
      userId: credential.createdBy,
      payload: {
        direction: "RECEIVED",
        amount: pendingConfirmedPayment.amount,
        currency: normalized.payment.currency || "INR",
        paymentDate: normalized.payment.paidAt ? new Date(normalized.payment.paidAt) : new Date(),
        paymentMethod: normalized.payment.method || "EXTERNAL",
        referenceNumber: normalized.payment.reference || normalized.externalOrderId,
        customerId: pendingConfirmedPayment.customerId,
        notes: `External payment from ${normalized.source}`,
      },
    });
    const allocation = await allocatePayment({
      businessId: credential.businessId,
      userId: credential.createdBy,
      paymentId: payment._id,
      payload: { invoiceId: pendingConfirmedPayment.invoiceId, allocatedAmount: pendingConfirmedPayment.amount },
    });
    await IntegrationEvent.updateOne({ _id: event._id, businessId: credential.businessId }, { paymentId: payment._id, allocationId: allocation._id, status: "PROCESSED", errorMessage: "" });
  }
  if (normalized.sendInvoice && event.invoiceId) {
    sendInvoiceMessage({ businessId: credential.businessId, invoiceId: event.invoiceId, channel: "EMAIL", createdBy: credential.createdBy }).catch(() => {});
  }
  return { event, idempotent: false };
};

module.exports = {
  authenticateIntegrationKey,
  createCredential,
  hashValue,
  ingestExternalOrder,
  listCredentials,
  revokeCredential,
};
