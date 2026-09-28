const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { transformSync } = require('esbuild');
function load(relative, stubs = {}, globals = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const source = transformSync(fs.readFileSync(filename, 'utf8'), { loader: filename.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs', jsx: 'automatic' }).code;
  const module = { exports: {} }, localRequire = createRequire(filename);
  vm.runInNewContext(source, { module, exports: module.exports, require: name => name in stubs ? stubs[name] : localRequire(name), setTimeout, clearTimeout, ...globals });
  return module.exports;
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(loggedIn = true, fail = false) {
  const effects = [], errors = [], navigations = [], storage = new Map();
  const sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  let session = { accessToken: loggedIn ? 'session-a' : '', user: { id: 'user-a' }, business: { id: 'business-a' } }, calls = 0;
  const cache = load('features/integrations/handoffRequest.js');
  const authStore = selector => selector(session);
  const Component = load('features/integrations/InvoiceHandoffPage.jsx', {
    react: { useEffect: effect => effects.push(effect), useState: () => ['', error => errors.push(error)] },
    'react-router-dom': { useNavigate: () => path => navigations.push(path), useSearchParams: () => [new URLSearchParams('token=test-token')] },
    '../../components/ui/RouteFallback': () => null,
    '../../store/authStore': { authStore },
    '../auth/api': { resolveInvoiceHandoffRequest: async () => { calls++; if (fail) throw { response: { status: 410, data: { message: 'Expired or used' } } }; return { customer: { _id: 'customer-a' } }; } },
    './handoffRequest': cache,
  }, { sessionStorage }).default;
  const render = () => { Component(); return effects.at(-1); };
  return { render, cache, storage, sessionStorage, effects, errors, navigations, calls: () => calls, setSession(value) { session = { ...session, ...value }; } };
}

test('Strict Mode setup/cleanup/setup consumes one token and navigates from the active effect', async () => {
  const h = harness();
  const effect = h.render(); const cleanup = effect(); cleanup(); effect();
  await flush();
  assert.equal(h.calls(), 1); assert.deepEqual(h.navigations, ['/dashboard/invoices?action=create']);
  assert.equal(h.storage.get('billstack-invoice-handoff-customer'), 'customer-a');
  assert.equal(h.errors.length, 0); h.cache.clearHandoffRequests();
});

test('access token refresh joins the existing consume request', async () => {
  const h = harness(); const cleanup = h.render()(); cleanup();
  h.setSession({ accessToken: 'session-refreshed' }); h.render()(); await flush();
  assert.equal(h.calls(), 1); assert.equal(h.navigations.length, 1); h.cache.clearHandoffRequests();
});

test('logged-out handoff survives normal login then consumes exactly once', async () => {
  const h = harness(false); h.render()();
  assert.equal(h.calls(), 0); assert.equal(h.navigations[0], '/login');
  assert.equal(h.storage.get('billstack-invoice-handoff-token'), 'test-token');
  const hook = load('features/auth/useAuth.js', {
    'react-router-dom': { useNavigate: () => path => h.navigations.push(path) },
    './api': { loginRequest: async () => ({ accessToken: 'new-session', user: { id: 'user-a' }, business: { id: 'business-a', onboardingCompleted: true } }) },
    '../../store/authStore': { authStore: () => ({ setSession: h.setSession }) },
    '../../store/uiStore': { uiStore: { getState: () => ({ pushToast() {} }) } },
  }, { sessionStorage: h.sessionStorage }).useAuth;
  await hook().login({});
  assert.equal(h.navigations.at(-1), '/integration/invoice-handoff?token=test-token');
  const effect = h.render(); const cleanup = effect(); cleanup(); effect(); await flush();
  assert.equal(h.calls(), 1); assert.equal(h.navigations.at(-1), '/dashboard/invoices?action=create');
  assert.equal(h.storage.has('billstack-invoice-handoff-token'), false); h.cache.clearHandoffRequests();
});

test('expired/used token shows an error without replaying consumption or redirecting to editor', async () => {
  const h = harness(true, true); const effect = h.render(); effect()(); effect(); await flush();
  assert.equal(h.calls(), 1); assert.equal(h.errors[0], 'Expired or used'); assert.equal(h.navigations.length, 0);
  h.cache.clearHandoffRequests();
});

test('handoff cache never shares context between businesses/users and clears on logout', async () => {
  const cache = load('features/integrations/handoffRequest.js'); let calls = 0;
  const args = { token: 'same', userId: 'u1', businessId: 'b1', request: async () => ++calls };
  assert.equal(await cache.consumeHandoffOnce(args), 1);
  assert.equal(await cache.consumeHandoffOnce({ ...args, businessId: 'b2' }), 2);
  assert.equal(await cache.consumeHandoffOnce({ ...args, userId: 'u2' }), 3);
  cache.clearHandoffRequests(); assert.equal(await cache.consumeHandoffOnce(args), 4); cache.clearHandoffRequests();
});
