export const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
export const compactMoney = value => `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value || 0))}`;
export const safeName = (value, fallback) => typeof value === "string" && value.trim() && !/^[a-f\d]{24}$/i.test(value) ? value : fallback;
export const reportRows = (rows, meta, preview, serverPaged) => preview ? rows.slice(0, 5) : serverPaged ? rows.slice(0, meta.limit) : rows.slice((meta.page - 1) * meta.limit, meta.page * meta.limit);
