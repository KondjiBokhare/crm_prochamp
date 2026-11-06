import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_PERMISSION_REGISTRY } from "../auth/roles.js";
import {
  canAccessPage,
  defaultPermissionsForRole,
} from "./staffUserService.js";
import { loadOptionalNotifications } from "./optionalNotifications.js";

const employee = (overrides = {}) => ({
  isAuthenticated: true,
  active: true,
  role: "SALES",
  organizationId: 1,
  permissions: [],
  ...overrides,
});

test("page access depends on explicit permissions, not role", () => {
  assert.equal(
    canAccessPage(employee({ permissions: ["leads"] }), "leads"),
    true
  );
  assert.equal(
    canAccessPage(employee({ permissions: ["leads"] }), "orders"),
    false
  );
  assert.equal(
    canAccessPage(employee({ permissions: ["orders"] }), "orders"),
    true
  );
  assert.equal(canAccessPage(employee(), "orders"), false);
  assert.equal(
    canAccessPage(employee({ role: "ADMIN" }), "orders"),
    false
  );
});

test("page access requires an authenticated active organization employee", () => {
  assert.equal(
    canAccessPage(employee({ isAuthenticated: false, permissions: ["leads"] }), "leads"),
    false
  );
  assert.equal(
    canAccessPage(employee({ active: false, permissions: ["leads"] }), "leads"),
    false
  );
  assert.equal(
    canAccessPage(employee({ organizationId: null, permissions: ["leads"] }), "leads"),
    false
  );
  assert.equal(
    canAccessPage(employee({ role: "CUSTOMER", permissions: ["leads"] }), "leads"),
    false
  );
});

test("role changes never generate page permissions and registry entries are complete", () => {
  assert.deepEqual(defaultPermissionsForRole("SALES"), []);
  assert.equal(canAccessPage(employee({ permissions: ["leads"] }), "notifications"), false);
  for (const [key, page] of Object.entries(PAGE_PERMISSION_REGISTRY)) {
    assert.ok(page.route, `${key} should define its route`);
    assert.ok(page.apiModule, `${key} should define its backend API module`);
    assert.ok(page.label, `${key} should define its permission label`);
  }
});

test("notification API failures stay local and do not reject page loading", async () => {
  const result = await loadOptionalNotifications(async () => {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  });

  assert.deepEqual(result, { rows: [], error: "Forbidden" });
});
