const AppError = require("./AppError");
const reportDateRange = ({ from, to } = {}) => {
  const parse = value => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError("Use a valid YYYY-MM-DD report date.", 400);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AppError("Use a valid report date.", 400);
    return date;
  };
  if (!from && !to) return {};
  const start = from ? parse(from) : new Date(0);
  const end = to ? parse(to) : new Date();
  if (from && to && start > end) throw new AppError("From date must be on or before To date.", 400);
  return to ? { $gte: start, $lt: new Date(end.getTime() + 86400000) } : { $gte: start, $lte: end };
};
module.exports = { reportDateRange };
