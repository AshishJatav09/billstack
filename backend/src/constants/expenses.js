const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Internet & Communication",
  "Salary & Wages",
  "Travel",
  "Marketing & Advertising",
  "Office Supplies",
  "Software & Subscriptions",
  "Repairs & Maintenance",
  "Professional Fees",
  "Bank Charges",
  "Taxes & Fees",
  "Miscellaneous",
];

const EXPENSE_PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"];
const EXPENSE_PAYMENT_METHODS = ["", "CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"];
const EXPENSE_STATUSES = ["ACTIVE", "CANCELLED"];
const EXPENSE_GST_TYPES = ["NONE", "GST_RECORDED", "EXEMPT"];

module.exports = {
  EXPENSE_CATEGORIES,
  EXPENSE_GST_TYPES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_STATUSES,
};
