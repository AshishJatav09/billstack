const policy = require("../../../shared/gst-policy.cjs");
const AppError = require("./appError");
const GSTIN_PATTERN = policy.gstinPattern;
const STATE_CODE_PATTERN = /^(0[1-9]|[1-2][0-9]|3[0-8])$/;
const VALID_GST_CLASSIFICATIONS = new Set(["", "TAXABLE", "EXEMPT", "ZERO_RATED"]);
const validateGstin = (value) => !value || policy.validGstin(value);
const validateStateCode = (value) => policy.validState(value);
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
  if (tax > 0 && !validateStateCode(supplierStateCode)) throw new AppError("Business GST state is required. Correct GST & Tax settings before issuing.", 400);
  if (tax > 0 && !validateStateCode(placeOfSupplyCode)) throw new AppError("Place of Supply is required. Select a valid state before issuing.", 400);
  const intraState = validateStateCode(supplierStateCode) && validateStateCode(placeOfSupplyCode) && policy.normalizeCode(supplierStateCode) === policy.normalizeCode(placeOfSupplyCode);
  const cgst = intraState ? roundMoney(tax / 2) : 0;
  return { taxableValue: taxable, rate: gstRate, intraState: Boolean(intraState), cgst, sgst: intraState ? roundMoney(tax - cgst) : 0, utgst: 0, igst: intraState ? 0 : tax, totalTax: tax, exempt: Boolean(exempt) };
};
const buildGstSnapshot = ({ business, counterparty, lineItems, products = [], placeOfSupplyCode }) => {
  let configuration;
  try { configuration = policy.normalizeBusinessGst({ ...business.gstConfiguration, enabled: true, gstin: business.gstConfiguration?.gstin || business.gstTaxId }); } catch (error) { throw new AppError(error.message, 400); }
  const supplierStateCode = configuration.stateCode;
  const pos = policy.normalizeCode(placeOfSupplyCode || counterparty.placeOfSupplyCode || counterparty.stateCode || (policy.validGstin(counterparty.gstNumber) ? String(counterparty.gstNumber).slice(0, 2) : ""));
  if (!validateStateCode(pos)) throw new AppError("Place of Supply is required. Select a valid state before issuing.", 400);
  if (counterparty.gstNumber && !validateGstin(counterparty.gstNumber)) throw new AppError("Customer GSTIN is invalid. Correct it in the customer profile, or clear it if the customer is not GST registered.", 400);
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
  return { gstin: configuration.gstin, supplierStateCode, supplierState: configuration.state, placeOfSupplyCode: pos, placeOfSupply: policy.states[pos], lines, ...summary };
};
module.exports = { GSTIN_PATTERN, STATE_CODE_PATTERN, validateGstin, validateStateCode, validateGstClassification, calculateGst, buildGstSnapshot };
