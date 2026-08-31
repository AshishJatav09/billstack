const AppError = require("./appError");

const toMinorUnits = (value, field = "Amount", { allowZero = false } = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || (!allowZero && numeric === 0)) throw new AppError(field + " must be a positive monetary amount", 400);
  const minorUnits = Math.round((numeric + Number.EPSILON) * 100);
  if (Math.abs(numeric * 100 - minorUnits) > 0.000001) throw new AppError(field + " supports at most two decimal places", 400);
  return minorUnits;
};
const fromMinorUnits = (minorUnits) => Number((Number(minorUnits) / 100).toFixed(2));
module.exports = { fromMinorUnits, toMinorUnits };
