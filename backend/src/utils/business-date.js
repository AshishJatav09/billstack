const businessDateKey = (value, timeZone = process.env.BILLSTACK_DEFAULT_TIMEZONE || "Asia/Kolkata") => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const isOverdueByBusinessDate = (dueDate, now = new Date(), timeZone) => {
  const due = businessDateKey(dueDate, timeZone);
  const current = businessDateKey(now, timeZone);
  return Boolean(due && current && current > due);
};

module.exports = {
  businessDateKey,
  isOverdueByBusinessDate,
};
