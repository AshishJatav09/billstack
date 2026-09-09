const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/;
const STATE_CODE_PATTERN = /^(0[1-9]|[1-2][0-9]|3[0-8])$/;
const VALID_GST_CLASSIFICATIONS = new Set(["", "TAXABLE", "EXEMPT", "ZERO_RATED"]);
const validateGstin = (value) => !value || GSTIN_PATTERN.test(String(value).toUpperCase());
const validateStateCode = (value) => STATE_CODE_PATTERN.test(String(value || ""));
const validateGstClassification = (value) => VALID_GST_CLASSIFICATIONS.has(String(value || "").toUpperCase());
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const normalizeGstRate = (rate) => {
  const value = Number(rate || 0);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Invalid GST rate");
  }
  return value;
};
const calculateGst = ({ taxableValue, rate = 0, supplierStateCode, placeOfSupplyCode, exempt = false }) => {
  const rawTaxable = Number(taxableValue || 0);
  if (!Number.isFinite(rawTaxable) || rawTaxable < 0) {
    throw new Error("Invalid GST taxable value");
  }
  const taxable = roundMoney(rawTaxable);
  const gstRate = exempt ? 0 : normalizeGstRate(rate);
  const tax = roundMoney(taxable * gstRate / 100);
  const intraState = supplierStateCode && placeOfSupplyCode && String(supplierStateCode) === String(placeOfSupplyCode);
  return { taxableValue: taxable, rate: gstRate, intraState: Boolean(intraState), cgst: intraState ? roundMoney(tax / 2) : 0, sgst: intraState ? roundMoney(tax / 2) : 0, utgst: 0, igst: intraState ? 0 : tax, totalTax: tax, exempt: Boolean(exempt) };
};
const buildGstSnapshot = ({ business, counterparty, lineItems, products = [], placeOfSupplyCode }) => {
  const supplierStateCode = business.gstConfiguration?.stateCode || "";
  const pos = placeOfSupplyCode || counterparty.placeOfSupplyCode || counterparty.stateCode || "";
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const summary = { cgst: 0, sgst: 0, utgst: 0, igst: 0, taxableValue: 0, totalTax: 0, hsnSacSummary: {} };
  const lines = lineItems.map((line) => {
    const product = line.productId ? productMap.get(line.productId.toString()) : null;
    const gstClassification = String(line.gstClassification || product?.gstClassification || "TAXABLE").toUpperCase();
    if (!validateGstClassification(gstClassification)) {
      throw new Error("Invalid GST classification");
    }
    const exempt = ["EXEMPT", "ZERO_RATED"].includes(gstClassification) || Number(line.taxRate || 0) === 0;
    const gst = calculateGst({ taxableValue: line.taxableAmount ?? line.lineTotal ?? 0, rate: line.taxRate || 0, supplierStateCode, placeOfSupplyCode: pos, exempt });
    summary.cgst = roundMoney(summary.cgst + gst.cgst);
    summary.sgst = roundMoney(summary.sgst + gst.sgst);
    summary.utgst = roundMoney(summary.utgst + gst.utgst);
    summary.igst = roundMoney(summary.igst + gst.igst);
    summary.taxableValue = roundMoney(summary.taxableValue + gst.taxableValue);
    summary.totalTax = roundMoney(summary.totalTax + gst.totalTax);
    const hsnSac = product?.hsnSac || line.hsnSac || "";
    if (hsnSac) summary.hsnSacSummary[hsnSac] = roundMoney((summary.hsnSacSummary[hsnSac] || 0) + gst.taxableValue);
    return { ...gst, hsnSac, gstClassification };
  });
  return { gstin: business.gstConfiguration?.gstin || business.gstTaxId || "", supplierStateCode, placeOfSupplyCode: pos, lines, ...summary };
};
module.exports = { GSTIN_PATTERN, STATE_CODE_PATTERN, validateGstin, validateStateCode, validateGstClassification, calculateGst, buildGstSnapshot };
