export const estimatedQuoteTotal = (form) => form.lineItems.reduce((total, line) => {
  const base = Number(line.quantity || 0) * Number(line.rate || 0);
  const discount = line.discountType === "amount" ? Number(line.discountValue || 0) : base * Number(line.discountValue || 0) / 100;
  const taxable = Math.max(0, base - Math.min(base, Math.max(0, discount)));
  return total + taxable * (1 + Number(line.taxRate || 0) / 100);
}, 0) + Number(form.shippingCharges || 0) + Number(form.roundOff || 0);
