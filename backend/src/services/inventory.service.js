const Business = require("../models/Business");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const AppError = require("../utils/appError");

const movementDeltaMap = {
  IN: 1,
  OUT: -1,
  ADJUSTMENT: null,
  RETURN: 1,
  DAMAGED: -1,
  OPENING: null,
};

const buildInventoryFlags = (product) => ({
  isLowStock:
    product.trackInventory &&
    product.currentStock > 0 &&
    product.currentStock <= product.minimumStockLevel,
  isOutOfStock: product.trackInventory && product.currentStock <= 0,
});

const computeNextStock = ({ type, quantity, previousStock }) => {
  if (type === "ADJUSTMENT" || type === "OPENING") {
    return quantity;
  }

  return previousStock + movementDeltaMap[type] * quantity;
};

const applyStockMovement = async ({
  businessId,
  productId,
  type,
  quantity,
  reason,
  referenceType,
  referenceId,
  createdBy,
}) => {
  const [business, product] = await Promise.all([
    Business.findById(businessId),
    Product.findOne({ _id: productId, businessId }),
  ]);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  if (!product.trackInventory) {
    throw new AppError("Inventory tracking is disabled for this product", 400);
  }

  const safeQuantity = Number(quantity);

  if (!Number.isFinite(safeQuantity) || safeQuantity < 0) {
    throw new AppError("Stock movement quantity must be a valid positive number", 400);
  }

  const previousStock = product.currentStock;
  const newStock = computeNextStock({
    type,
    quantity: safeQuantity,
    previousStock,
  });

  if (!business.inventorySettings?.allowNegativeStock && newStock < 0) {
    throw new AppError("Insufficient stock. Negative stock is not allowed for this business.", 403);
  }

  product.currentStock = newStock;
  const flags = buildInventoryFlags(product);
  product.isLowStock = flags.isLowStock;
  product.isOutOfStock = flags.isOutOfStock;
  await product.save();

  const movement = await StockMovement.create({
    businessId,
    productId,
    type,
    quantity: safeQuantity,
    previousStock,
    newStock,
    reason: reason?.trim() || "",
    referenceType: referenceType || "MANUAL",
    referenceId: referenceId?.trim() || "",
    createdBy,
  });

  return { movement, product };
};

module.exports = {
  applyStockMovement,
  buildInventoryFlags,
};

