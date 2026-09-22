import gstStates from "../../../../shared/indian-gst-states.json";

export const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const normalizeGstin = (value) => String(value || "").trim().toUpperCase();

export const stateCodeFromGstin = (value) => {
  const gstin = normalizeGstin(value);
  const code = gstin.slice(0, 2);
  return gstStates[code] ? code : "";
};

export const updateCustomerGstFields = (form, value) => {
  const gstNumber = normalizeGstin(value);
  const derivedStateCode = stateCodeFromGstin(gstNumber);
  return { ...form, gstNumber, ...(derivedStateCode ? { stateCode: derivedStateCode, placeOfSupplyCode: derivedStateCode } : {}) };
};

export const validateOptionalGstin = (value) => {
  const gstin = normalizeGstin(value);
  return !gstin || (gstinPattern.test(gstin) && Boolean(gstStates[gstin.slice(0, 2)]));
};

export { gstStates };
