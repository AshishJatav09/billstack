const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const customerCreateValidator = (body) => {
  const errors = {};

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Customer name must be at least 2 characters";
  }

  if (body.email && !isEmail(body.email)) {
    errors.email = "Customer email must be valid";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const customerUpdateValidator = customerCreateValidator;

const supplierCreateValidator = (body) => {
  const errors = {};

  if (!body.supplierName || body.supplierName.trim().length < 2) {
    errors.supplierName = "Supplier name must be at least 2 characters";
  }

  if (body.email && !isEmail(body.email)) {
    errors.email = "Supplier email must be valid";
  }

  if (body.paymentStatus && !["paid", "partial", "unpaid"].includes(body.paymentStatus)) {
    errors.paymentStatus = "Payment status is invalid";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const supplierUpdateValidator = supplierCreateValidator;

const productCreateValidator = (body) => {
  const errors = {};

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Product name must be at least 2 characters";
  }

  ["purchasePrice", "sellingPrice", "taxRate", "discount", "currentStock", "openingStock", "minimumStockLevel"].forEach(
    (field) => {
      if (body[field] !== undefined && Number.isNaN(Number(body[field]))) {
        errors[field] = `${field} must be a valid number`;
      }
    }
  );

  if (body.status && !["active", "inactive"].includes(body.status)) {
    errors.status = "Status must be active or inactive";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const productUpdateValidator = productCreateValidator;

const stockMovementValidator = (body) => {
  const errors = {};

  if (!body.type || !["IN", "OUT", "ADJUSTMENT", "RETURN", "DAMAGED"].includes(body.type)) {
    errors.type = "A valid stock movement type is required";
  }

  if (body.quantity === undefined || Number.isNaN(Number(body.quantity)) || Number(body.quantity) < 0) {
    errors.quantity = "Quantity must be a valid positive number";
  }

  if (
    body.referenceType &&
    !["INVOICE", "PURCHASE", "MANUAL", "RETURN"].includes(body.referenceType)
  ) {
    errors.referenceType = "Reference type is invalid";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const purchaseCreateValidator = (body) => {
  const errors = {};

  if (!body.supplierId) {
    errors.supplierId = "Supplier is required";
  }

  if (!Array.isArray(body.productsPurchased) || body.productsPurchased.length === 0) {
    errors.productsPurchased = "At least one purchased product is required";
  }

  if (Array.isArray(body.productsPurchased)) {
    body.productsPurchased.forEach((item, index) => {
      if (!item.productId) {
        errors[`productsPurchased.${index}.productId`] = "Product is required";
      }

      if (Number(item.quantity) <= 0 || Number.isNaN(Number(item.quantity))) {
        errors[`productsPurchased.${index}.quantity`] = "Quantity must be greater than zero";
      }

      if (Number(item.purchasePrice) < 0 || Number.isNaN(Number(item.purchasePrice))) {
        errors[`productsPurchased.${index}.purchasePrice`] = "Purchase price must be valid";
      }
    });
  }

  if (body.paidAmount !== undefined && Number.isNaN(Number(body.paidAmount))) {
    errors.paidAmount = "Paid amount must be valid";
  }

  if (body.paymentStatus && !["paid", "partial", "unpaid"].includes(body.paymentStatus)) {
    errors.paymentStatus = "Payment status is invalid";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const invoiceCreateValidator = (body) => {
  const errors = {};

  if (!body.customerId) {
    errors.customerId = "Customer is required";
  }

  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    errors.lineItems = "At least one invoice line item is required";
  }

  if (Array.isArray(body.lineItems)) {
    body.lineItems.forEach((item, index) => {
      if (!item.productId) {
        errors[`lineItems.${index}.productId`] = "Product is required";
      }
      if (Number(item.quantity) <= 0 || Number.isNaN(Number(item.quantity))) {
        errors[`lineItems.${index}.quantity`] = "Quantity must be greater than zero";
      }
      if (Number(item.rate) < 0 || Number.isNaN(Number(item.rate))) {
        errors[`lineItems.${index}.rate`] = "Rate must be valid";
      }
    });
  }

  ["shippingCharges", "roundOff", "amountPaid"].forEach((field) => {
    if (body[field] !== undefined && Number.isNaN(Number(body[field]))) {
      errors[field] = `${field} must be valid`;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const invoiceUpdateValidator = invoiceCreateValidator;

module.exports = {
  customerCreateValidator,
  customerUpdateValidator,
  invoiceCreateValidator,
  invoiceUpdateValidator,
  purchaseCreateValidator,
  productCreateValidator,
  productUpdateValidator,
  stockMovementValidator,
  supplierCreateValidator,
  supplierUpdateValidator,
};
