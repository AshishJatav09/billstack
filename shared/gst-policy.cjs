// Single state catalogue for browser forms, backend validation, snapshots and PDFs.
const states = require("./indian-gst-states.json");
const normalizeCode = value => String(value || "").trim().padStart(2, "0");
const validState = value => Boolean(states[normalizeCode(value)]);
const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const validGstin = value => gstinPattern.test(String(value || "").trim().toUpperCase()) && validState(String(value || "").trim().slice(0, 2));
const normalizeBusinessGst = configuration => {
  const gstin = String(configuration.gstin || "").trim().toUpperCase();
  if (!configuration.enabled) return { enabled: false, gstin: "", stateCode: "", state: "" };
  if (!validGstin(gstin)) throw new Error("Enter a valid GSTIN for a GST registered business.");
  const derivedCode = gstin.slice(0, 2);
  const code = configuration.stateCode ? normalizeCode(configuration.stateCode) : derivedCode;
  if (!validState(code)) throw new Error("Select a valid business GST state.");
  if (code !== derivedCode) throw new Error(`GSTIN belongs to ${states[derivedCode]} (${derivedCode}), but the selected business state is ${states[code]} (${code}). Please correct the GST details.`);
  if (configuration.state && String(configuration.state).trim().toLowerCase() !== states[code].toLowerCase()) throw new Error(`Business state must be ${states[code]} (${code}) for this GSTIN.`);
  return { enabled: true, gstin, stateCode: code, state: states[code] };
};
module.exports = { states, normalizeCode, validState, validGstin, gstinPattern, normalizeBusinessGst };
