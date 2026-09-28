function integrationLogUrl(req) {
  return String(req.originalUrl || req.url || '')
    .replace(/(\/integrations\/handoffs\/invoice\/)[^/?\s]+/gi, '$1[REDACTED]')
    .replace(/([?&]token=)[^&\s]*/gi, '$1[REDACTED]');
}
module.exports = { integrationLogUrl };
