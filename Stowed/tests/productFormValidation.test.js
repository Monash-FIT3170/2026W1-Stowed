import assert from "assert";
import { validateProductFields, isDeferredError } from "../imports/api/products/validation";

const VALID = {
  name: "AAA Battery Pack",
  totalQuantity: "10",
  reorderAt: "",
  unitCost: "",
  purchaseCost: "",
  assignments: [{ locationId: "loc-1", quantity: "10" }],
};

function validate(overrides = {}) {
  return validateProductFields({ ...VALID, ...overrides });
}

describe("productFormValidation - validateProductFields()", function () {
  it("passes a complete, balanced form", function () {
    const { isValid, count } = validate();
    assert.strictEqual(isValid, true);
    assert.strictEqual(count, 0);
  });

  it("passes zero stock with no assignments", function () {
    assert.strictEqual(validate({ totalQuantity: "0", assignments: [] }).isValid, true);
  });

  it("requires a name and stock", function () {
    const { errors } = validate({ name: "  ", totalQuantity: "" });
    assert.strictEqual(errors.name, "Product name is required.");
    assert.strictEqual(errors.totalQuantity, "Stock is required.");
    assert.ok(isDeferredError(errors.name));
  });

  it("flags duplicate names", function () {
    const { errors } = validate({ isDuplicate: true });
    assert.strictEqual(errors.name, "A product with this name already exists.");
  });

  it("rejects negative numbers with specific, immediate messages", function () {
    const { errors, count } = validate({
      totalQuantity: "-1",
      reorderAt: "-2",
      unitCost: "-3",
      purchaseCost: "-4",
    });
    assert.strictEqual(errors.totalQuantity, "Stock can't be negative.");
    assert.strictEqual(errors.reorderAt, "Reorder level can't be negative.");
    assert.strictEqual(errors.unitCost, "Sell price can't be negative.");
    assert.strictEqual(errors.purchaseCost, "Purchase price can't be negative.");
    assert.strictEqual(count, 4);
    assert.ok(!isDeferredError(errors.totalQuantity));
  });

  it("rejects decimal stock and reorder levels", function () {
    const { errors } = validate({ totalQuantity: "1.5", reorderAt: "2.5" });
    assert.strictEqual(errors.totalQuantity, "Stock must be a whole number.");
    assert.strictEqual(errors.reorderAt, "Reorder level must be a whole number.");
  });

  it("allows decimal prices", function () {
    assert.strictEqual(validate({ unitCost: "4.99", purchaseCost: "2.5" }).isValid, true);
  });

  it("flags negative assignment quantities per row", function () {
    const { errors } = validate({
      assignments: [
        { locationId: "loc-1", quantity: "12" },
        { locationId: "loc-2", quantity: "-2" },
      ],
    });
    assert.strictEqual(errors.assignmentRows[1], "Quantity can't be negative.");
    assert.strictEqual(errors.assignmentRows[0], undefined);
  });

  it("asks for a location when only a quantity is entered", function () {
    const { errors } = validate({ assignments: [{ locationId: "", quantity: "10" }] });
    assert.strictEqual(errors.assignmentRows[0], "Choose a location for this quantity.");
    assert.ok(isDeferredError(errors.assignmentRows[0]));
  });

  it("ignores completely empty assignment rows", function () {
    const { isValid } = validate({
      assignments: [...VALID.assignments, { locationId: "", quantity: "" }],
    });
    assert.strictEqual(isValid, true);
  });

  it("explains under- and over-assignment", function () {
    assert.strictEqual(
      validate({ assignments: [{ locationId: "loc-1", quantity: "4" }] }).errors.assignments,
      "6 of 10 units still need a location.",
    );
    assert.match(
      validate({ assignments: [{ locationId: "loc-1", quantity: "12" }] }).errors.assignments,
      /^Over-assigned by 2 units/,
    );
  });
});
