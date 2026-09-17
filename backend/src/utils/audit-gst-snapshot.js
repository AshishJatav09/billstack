const { calculateGst } = require("./gst");
const { validGstin, validState } = require("../../../shared/gst-policy.cjs");
const auditGstSnapshot = invoice => {
  const snapshot = invoice.gstSnapshot;
  const old = snapshot || invoice.gstBreakup || {};
  const result = { invoiceNumber: invoice.invoiceNumber, taxableValue: old.taxableValue ?? null, oldCgst: old.cgst ?? null, oldSgst: old.sgst ?? null, oldIgst: old.igst ?? null, expectedCgst: null, expectedSgst: null, expectedIgst: null };
  if (!snapshot || !validGstin(snapshot.gstin) || !validState(snapshot.placeOfSupplyCode) || !Array.isArray(snapshot.lines) || !snapshot.lines.length || snapshot.lines.some(line => line.taxableValue == null || line.rate == null || !Number.isFinite(Number(line.taxableValue)) || Number(line.taxableValue) < 0 || !Number.isFinite(Number(line.rate)) || Number(line.rate) < 0 || Number(line.rate) > 100)) return { ...result, reason: "Indeterminate: missing historical GSTIN, Place of Supply or line evidence; current customer/business data is not used." };
  const expected = snapshot.lines.map(line => calculateGst({ taxableValue: line.taxableValue, rate: line.rate, exempt: line.exempt, supplierStateCode: snapshot.gstin.slice(0, 2), placeOfSupplyCode: snapshot.placeOfSupplyCode }));
  for (const [field, key] of [["expectedCgst", "cgst"], ["expectedSgst", "sgst"], ["expectedIgst", "igst"]]) result[field] = Math.round(expected.reduce((sum,line) => sum + line[key],0) * 100) / 100;
  return { ...result, reason: snapshot.supplierStateCode !== snapshot.gstin.slice(0, 2) ? "Historical supplier state contradicts GSTIN prefix; review required, no mutation." : ["cgst", "sgst", "igst"].some(key => result[`expected${key[0].toUpperCase()}${key.slice(1)}`] !== Number(old[key] || 0)) ? "Historical tax components differ; review required, no mutation." : "Historical components consistent." };
};
module.exports = { auditGstSnapshot };
