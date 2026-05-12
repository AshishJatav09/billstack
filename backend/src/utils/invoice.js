const buildInvoiceTotals = ({
  lineItems,
  shippingCharges = 0,
  roundOff = 0,
  amountPaid = 0,
}) => {
  const normalizedItems = lineItems.map((item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const lineBase = quantity * rate;
    const taxRate = Number(item.taxRate || 0);
    const discountType = item.discountType === "amount" ? "amount" : "percent";
    const discountValue = Number(
      item.discountValue !== undefined ? item.discountValue : item.discount || 0
    );
    const discountAmount =
      discountType === "percent"
        ? Math.min(lineBase, (lineBase * Math.max(discountValue, 0)) / 100)
        : Math.min(lineBase, Math.max(discountValue, 0));
    const taxableAmount = Math.max(lineBase - discountAmount, 0);
    const taxAmount = (taxableAmount * Math.max(taxRate, 0)) / 100;
    const itemTotal = taxableAmount + taxAmount;

    return {
      ...item,
      quantity,
      rate,
      taxRate,
      discountType,
      discountValue,
      lineBase,
      discount: discountAmount,
      discountAmount,
      taxableAmount,
      tax: taxAmount,
      taxAmount,
      itemTotal,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineBase, 0);
  const totalTax = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalDiscount = normalizedItems.reduce((sum, item) => sum + item.discountAmount, 0);
  const normalizedShipping = Number(shippingCharges || 0);
  const normalizedRoundOff = Number(roundOff || 0);
  const grandTotal =
    subtotal + totalTax - totalDiscount + normalizedShipping + normalizedRoundOff;
  const normalizedAmountPaid = Number(amountPaid || 0);
  const balanceDue = Math.max(grandTotal - normalizedAmountPaid, 0);

  return {
    lineItems: normalizedItems,
    subtotal,
    totalTax,
    totalDiscount,
    shippingCharges: normalizedShipping,
    roundOff: normalizedRoundOff,
    grandTotal,
    amountPaid: normalizedAmountPaid,
    balanceDue,
    paymentStatus:
      normalizedAmountPaid >= grandTotal
        ? "paid"
        : normalizedAmountPaid > 0
          ? "partial"
          : "unpaid",
  };
};

const buildInvoiceNumber = ({ prefix, format, sequence, date = new Date() }) => {
  const year = String(date.getFullYear());
  const paddedSequence = String(sequence).padStart(4, "0");

  return format
    .replaceAll("{YYYY}", year)
    .replaceAll("{0001}", paddedSequence)
    .replaceAll("INV", prefix || "INV");
};

module.exports = {
  buildInvoiceNumber,
  buildInvoiceTotals,
};
