import assert from "assert";
import { hasClientPermission } from "../imports/api/userMethods";
import { ROLES } from "../imports/api/roles";

describe("Role-Based Access Control", function () {
  it("denies access when role is missing", function () {
    assert.strictEqual(hasClientPermission(null, "route:/inventory"), false);
  });

  it("denies access for unknown permissions", function () {
    assert.strictEqual(
      hasClientPermission(ROLES.ADMIN, "route:/unknown"),
      false,
    );
  });

  it("enforces role hierarchy for protected routes", function () {
    assert.strictEqual(
      hasClientPermission(ROLES.STANDARD, "route:/inventory"),
      true,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.STANDARD, "route:/qr-codes"),
      false,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.ADMIN, "route:/qr-codes"),
      true,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.ADMIN, "route:/accounts"),
      false,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.OWNER, "route:/accounts"),
      true,
    );
  });

  it("allows elevated roles to access standard routes", function () {
    assert.strictEqual(
      hasClientPermission(ROLES.ADMIN, "route:/inventory"),
      true,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.OWNER, "route:/inventory"),
      true,
    );
  });

  it("enforces admin-only product permissions", function () {
    assert.strictEqual(
      hasClientPermission(ROLES.STANDARD, "products.create"),
      false,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.ADMIN, "products.create"),
      true,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.OWNER, "products.create"),
      true,
    );
  });

  it("enforces standard-level restock permission", function () {
    assert.strictEqual(
      hasClientPermission(ROLES.STANDARD, "products.restock"),
      true,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.ADMIN, "products.restock"),
      true,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.OWNER, "products.restock"),
      true,
    );
  });

  it("enforces owner-only user management", function () {
    assert.strictEqual(
      hasClientPermission(ROLES.ADMIN, "create-users"),
      false,
    );
    assert.strictEqual(
      hasClientPermission(ROLES.OWNER, "create-users"),
      true,
    );
  });
});
