// Share one consume request across effect replay, token refresh and remounts.
// Cache is scoped to the authenticated user/business, never the access token.
const requests = new Map();
export function consumeHandoffOnce({ token, userId, businessId, request }) {
  const key = JSON.stringify([businessId, userId, token]);
  const existing = requests.get(key);
  if (existing) return existing.promise;
  const promise = Promise.resolve().then(() => request(token));
  const timer = setTimeout(() => requests.delete(key), 3 * 60 * 1000);
  timer.unref?.();
  requests.set(key, { promise, timer });
  // Keep failures too: a lost response may have consumed the token already.
  return promise;
}
export function clearHandoffRequests() {
  for (const entry of requests.values()) clearTimeout(entry.timer);
  requests.clear();
}
