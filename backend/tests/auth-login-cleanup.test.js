const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const frontend = (...parts) =>
  fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", ...parts), "utf8");

const invokeController = (handler, req = {}) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      },
    };
    handler(req, res, reject);
  });

const withEnv = async (values, fn) => {
  const keys = Object.keys(values);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("super admin login normalizes email and accepts exact configured password", async () => {
  const { superAdminLogin } = require("../src/controllers/super-admin.controller");

  await withEnv(
    {
      SUPER_ADMIN_EMAIL: "Owner@BillStack.Local",
      SUPER_ADMIN_PASSWORD: "exact pass 123",
      SUPER_ADMIN_JWT_SECRET: "test-super-admin-secret-with-enough-length",
      JWT_SECRET: undefined,
    },
    async () => {
      const result = await invokeController(superAdminLogin, {
        body: { email: "  owner@billstack.local  ", password: "exact pass 123" },
      });

      assert.equal(result.statusCode, 200);
      assert.equal(result.payload.data.email, "owner@billstack.local");
      assert.equal(typeof result.payload.data.accessToken, "string");
      assert.ok(result.payload.data.accessToken.length > 20);
    }
  );
});

test("super admin login rejects wrong exact password and missing configuration clearly", async () => {
  const { superAdminLogin } = require("../src/controllers/super-admin.controller");

  await withEnv(
    {
      SUPER_ADMIN_EMAIL: "owner@billstack.local",
      SUPER_ADMIN_PASSWORD: "CorrectPassword",
      SUPER_ADMIN_JWT_SECRET: "test-super-admin-secret-with-enough-length",
    },
    async () => {
      await assert.rejects(
        () =>
          invokeController(superAdminLogin, {
            body: { email: "owner@billstack.local", password: "correctpassword" },
          }),
        /Invalid super admin credentials/
      );
    }
  );

  await withEnv(
    {
      SUPER_ADMIN_EMAIL: undefined,
      SUPER_ADMIN_PASSWORD: undefined,
      SUPER_ADMIN_JWT_SECRET: undefined,
      JWT_SECRET: undefined,
    },
    async () => {
      await assert.rejects(
        () => invokeController(superAdminLogin, { body: { email: "", password: "" } }),
        /Super admin login is not configured/
      );
    }
  );
});

test("auth pages have no dead demo link and hide Google auth when unconfigured", () => {
  const authLayout = frontend("components", "layout", "AuthLayout.jsx");
  const googleButton = frontend("features", "auth", "components", "GoogleAuthButton.jsx");
  const loginPage = frontend("features", "auth", "pages", "LoginPage.jsx");
  const registerPage = frontend("features", "auth", "pages", "RegisterPage.jsx");

  assert.doesNotMatch(authLayout, /View demo/);
  assert.doesNotMatch(authLayout, /to="\/dashboard"/);
  assert.match(googleButton, /if \(!clientId\) return null/);
  assert.match(loginPage, /googleClientId \?/);
  assert.match(registerPage, /googleClientId \?/);
});

test("login password fields use accessible show-hide controls", () => {
  const formField = frontend("components", "ui", "FormField.jsx");
  const input = frontend("components", "ui", "Input.jsx");
  const superAdminLogin = frontend("features", "super-admin", "pages", "SuperAdminLoginPage.jsx");

  assert.match(formField, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
  assert.match(input, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
  assert.match(superAdminLogin, /title="Super Admin Login"/);
  assert.match(superAdminLogin, /email: form\.email\.trim\(\)/);
});
