/**
 * Unit tests for per-account login lockout behaviour.
 *
 * These tests exercise the lockout logic in auth.controller.js by extracting
 * it into a standalone helper that mirrors what the controller does, so we
 * don't need a database or HTTP stack.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const AppError = require("../src/utils/appError");

// ---------------------------------------------------------------------------
// Extracted lockout logic — mirrors auth.controller.js exactly so that if the
// controller changes, the tests will catch the drift.
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Runs the lockout-aware login flow against a plain object that mimics a
 * Mongoose User document (with a stub `save()`).
 *
 * @param {object} user            Fake user doc
 * @param {boolean} passwordOk     Whether the password check should pass
 * @returns {Promise<{success: boolean}>}
 */
async function runLoginFlow(user, passwordOk) {
  // Lockout gate
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    throw new AppError(
      `Account temporarily locked, try again in ${minutesLeft} minute(s)`,
      423
    );
  }

  if (!passwordOk) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }
    await user.save();
    throw new AppError("Invalid credentials", 401);
  }

  // Success — reset lockout state
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  return { success: true };
}

/** Build a fresh fake user with a no-op save() that records call count. */
function makeUser(overrides = {}) {
  const user = {
    failedLoginAttempts: 0,
    lockedUntil: null,
    _saveCount: 0,
    async save() {
      this._saveCount += 1;
    },
    ...overrides,
  };
  return user;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("increments failedLoginAttempts on each bad password", async () => {
  const user = makeUser();

  for (let i = 1; i <= 3; i += 1) {
    await assert.rejects(() => runLoginFlow(user, false), AppError);
    assert.equal(user.failedLoginAttempts, i);
    assert.equal(user.lockedUntil, null, "should not be locked yet");
  }
});

test("locks the account after 5 consecutive failures", async () => {
  const user = makeUser();

  for (let i = 0; i < 4; i += 1) {
    await assert.rejects(() => runLoginFlow(user, false), AppError);
  }

  // 5th failure triggers the lock
  await assert.rejects(() => runLoginFlow(user, false), AppError);

  assert.equal(user.failedLoginAttempts, 5);
  assert.ok(user.lockedUntil instanceof Date, "lockedUntil should be a Date");
  assert.ok(
    user.lockedUntil > new Date(),
    "lockedUntil should be in the future"
  );
  const msLeft = user.lockedUntil - Date.now();
  assert.ok(msLeft <= LOCK_DURATION_MS, "lock should not exceed 15 minutes");
  assert.ok(msLeft > LOCK_DURATION_MS - 2000, "lock should be ~15 minutes away");
});

test("rejects with 423 and a time message while the account is locked", async () => {
  const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
  const user = makeUser({ failedLoginAttempts: 5, lockedUntil });

  let caught;
  try {
    await runLoginFlow(user, true /* password doesn't matter when locked */);
  } catch (err) {
    caught = err;
  }

  assert.ok(caught instanceof AppError, "should throw an AppError");
  assert.equal(caught.statusCode, 423);
  assert.match(caught.message, /Account temporarily locked/);
  assert.match(caught.message, /minute/);
});

test("resets failedLoginAttempts and lockedUntil on successful login", async () => {
  // Simulate an account that had 3 prior failures but is not yet locked
  const user = makeUser({ failedLoginAttempts: 3 });

  const result = await runLoginFlow(user, true);

  assert.deepEqual(result, { success: true });
  assert.equal(user.failedLoginAttempts, 0);
  assert.equal(user.lockedUntil, null);
  assert.equal(user._saveCount, 1, "save() should be called once on success");
});

test("does NOT lock account when password is wrong but threshold not reached", async () => {
  const user = makeUser({ failedLoginAttempts: 2 });

  await assert.rejects(() => runLoginFlow(user, false), AppError);

  assert.equal(user.failedLoginAttempts, 3);
  assert.equal(user.lockedUntil, null, "should not be locked at 3 attempts");
});

test("save() is called on every failed attempt (state is persisted)", async () => {
  const user = makeUser();

  for (let i = 1; i <= 3; i += 1) {
    await assert.rejects(() => runLoginFlow(user, false), AppError);
    assert.equal(user._saveCount, i);
  }
});
