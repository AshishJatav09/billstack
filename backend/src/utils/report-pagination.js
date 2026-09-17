const reportPagination = (rows, query = {}, key) => {
  const requestedSize = Number(query[`${key}Size`] || 10);
  const limit = [10, 25, 50].includes(requestedSize) ? requestedSize : 10;
  const requestedPage = Number(query[`${key}Page`] || 1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(totalPages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  return { items: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, totalPages } };
};
module.exports = { reportPagination };
