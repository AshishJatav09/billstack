require("../config/load-env")();

const mongoose = require("mongoose");
const Expense = require("../models/Expense");

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const shouldApply = process.argv.includes("--apply");

const deriveState = (expense) => {
  const totalAmount = roundMoney(expense.totalAmount);
  let paidAmount = roundMoney(expense.paidAmount);

  if (expense.paymentStatus === "PAID" && paidAmount === 0 && totalAmount > 0) {
    paidAmount = totalAmount;
  }

  if (paidAmount > totalAmount) {
    paidAmount = totalAmount;
  }

  const balanceAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));
  let paymentStatus = "UNPAID";
  if (paidAmount >= totalAmount && totalAmount > 0) paymentStatus = "PAID";
  else if (paidAmount > 0) paymentStatus = "PARTIAL";

  return { totalAmount, paidAmount, balanceAmount, paymentStatus };
};

const needsRepair = (expense, next) =>
  roundMoney(expense.paidAmount) !== next.paidAmount ||
  roundMoney(expense.balanceAmount) !== next.balanceAmount ||
  expense.paymentStatus !== next.paymentStatus;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const expenses = await Expense.find({ status: { $ne: "CANCELLED" } }).sort({ createdAt: -1 });
  const repairs = [];

  for (const expense of expenses) {
    const next = deriveState(expense);
    if (!needsRepair(expense, next)) continue;
    repairs.push({
      id: expense._id.toString(),
      expenseNumber: expense.expenseNumber,
      description: expense.description,
      before: {
        totalAmount: expense.totalAmount,
        paidAmount: expense.paidAmount,
        balanceAmount: expense.balanceAmount,
        paymentStatus: expense.paymentStatus,
      },
      after: next,
    });

    if (shouldApply) {
      expense.totalAmount = next.totalAmount;
      expense.paidAmount = next.paidAmount;
      expense.balanceAmount = next.balanceAmount;
      expense.paymentStatus = next.paymentStatus;
      await expense.save();
    }
  }

  console.table(
    repairs.map((repair) => ({
      no: repair.expenseNumber,
      statusBefore: repair.before.paymentStatus,
      paidBefore: repair.before.paidAmount,
      balanceBefore: repair.before.balanceAmount,
      statusAfter: repair.after.paymentStatus,
      paidAfter: repair.after.paidAmount,
      balanceAfter: repair.after.balanceAmount,
    }))
  );
  console.log(JSON.stringify({ apply: shouldApply, scanned: expenses.length, repaired: repairs.length }, null, 2));

  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect errors
  }
  process.exit(1);
});
