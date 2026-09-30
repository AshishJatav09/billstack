const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ rejected = false, onboarded = true } = {}) {
  let session = { accessToken: '', business: null }, status = 'anonymous';
  const effects = [];
  const Outlet = () => null, Navigate = () => null, RouteFallback = () => null;
  const source = transformSync(fs.readFileSync(path.resolve(__dirname, '../src/components/ui/GuestRoute.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  const stubs = {
    react: { useEffect: effect => effects.push(effect), useState: () => [status, next => { status = next; }] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-router-dom': { Navigate, Outlet },
    '../../store/authStore': { authStore: () => ({ ...session, clearAuth() { session = { accessToken: '', business: null }; }, setSession(next) { session = next; } }) },
    '../../features/auth/api': { currentSessionRequest: async () => { if (rejected) throw Error('Expired session'); return { user: {}, business: { onboardingCompleted: onboarded } }; } },
    './RouteFallback': { default: RouteFallback, __esModule: true },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => { assert.ok(name in stubs, name); return stubs[name]; } });
  return { render: module.exports.default, login() { session = { accessToken: 'new-session', business: { onboardingCompleted: onboarded } }; }, effect: () => effects.at(-1)(), Outlet, Navigate, RouteFallback };
}
test('new login waits before its validation effect and redirects only after validation', async () => {
  const h = harness();
  assert.equal(h.render().type, h.Outlet);
  h.login();
  assert.equal(h.render().type, h.RouteFallback, 'do not override intended login navigation before effect runs');
  h.effect();
  assert.equal(h.render().type, h.RouteFallback);
  await flush();
  const result = h.render();
  assert.equal(result.type, h.Navigate);assert.equal(result.props.to, '/dashboard');
});
test('invalid session returns to guest content without redirecting', async () => {
  const h = harness({ rejected: true });h.login();
  assert.equal(h.render().type,h.RouteFallback);h.effect();await flush();
  assert.equal(h.render().type,h.Outlet);
});
test('validated incomplete onboarding still uses the normal onboarding destination', async () => {
  const h = harness({ onboarded: false });h.login();h.render();h.effect();await flush();
  assert.equal(h.render().props.to,'/onboarding');
});
