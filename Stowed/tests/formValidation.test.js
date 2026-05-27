import assert from "assert";

function validateProductForm(fields = {}) {
  const errors = {};

  if (!fields.name || !fields.name.trim()) {
    errors.name = "Item name is required.";
  } else if (fields.name.trim().length > 100) {
    errors.name = "Item name must be 100 characters or fewer.";
  }

  if (
    fields.totalQuantity === undefined ||
    fields.totalQuantity === null ||
    fields.totalQuantity === ""
  ) {
    errors.totalQuantity = "Quantity is required.";
  } else if (!Number.isInteger(Number(fields.totalQuantity))) {
    errors.totalQuantity = "Quantity must be a whole number.";
  } else if (Number(fields.totalQuantity) < 0) {
    errors.totalQuantity = "Quantity cannot be negative.";
  }

  if (fields.reorderAt !== undefined && fields.reorderAt !== "") {
    if (!Number.isInteger(Number(fields.reorderAt))) {
      errors.reorderAt = "Reorder threshold must be a whole number.";
    } else if (Number(fields.reorderAt) < 0) {
      errors.reorderAt = "Reorder threshold cannot be negative.";
    }
  }

  if (fields.unitCost !== undefined && fields.unitCost !== "") {
    const cost = Number(fields.unitCost);
    if (isNaN(cost)) {
      errors.unitCost = "Unit cost must be a number.";
    } else if (cost < 0) {
      errors.unitCost = "Unit cost cannot be negative.";
    }
  }

  if (fields.assignments !== undefined) {
    if (!Array.isArray(fields.assignments) || fields.assignments.length === 0) {
      errors.assignments = "At least one location assignment is required.";
    } else {
      const assignedTotal = fields.assignments.reduce(
        (sum, a) => sum + (a.quantity || 0),
        0
      );
      if (assignedTotal !== Number(fields.totalQuantity)) {
        errors.assignments = "Assigned quantity must equal total quantity.";
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

describe("formValidation - validateProductForm()", function () {

  it("passes with all valid required fields", function () {
    const { valid, errors } = validateProductForm({
      name: "Hex bolts M8 × 50mm",
      totalQuantity: 4,
    });
    assert.strictEqual(valid, true);
    assert.deepStrictEqual(errors, {});
  });

  it("passes when optional fields are omitted", function () {
    const { valid } = validateProductForm({
      name: "Pine planks",
      totalQuantity: 10,
    });
    assert.strictEqual(valid, true);
  });

  it("passes when totalQuantity is 0", function () {
    const { valid } = validateProductForm({
      name: "LED bulbs E27",
      totalQuantity: 0,
    });
    assert.strictEqual(valid, true);
  });

  it("passes when reorderAt is 0", function () {
    const { valid } = validateProductForm({
      name: "Item A",
      totalQuantity: 5,
      reorderAt: 0,
    });
    assert.strictEqual(valid, true);
  });

  it("passes when reorderAt is numeric string", function () {
    const { valid } = validateProductForm({
      name: "Item",
      totalQuantity: 10,
      reorderAt: "5",
    });
    assert.strictEqual(valid, true);
  });

  it("passes when reorderAt is whitespace numeric string", function () {
    const { valid } = validateProductForm({
      name: "Item",
      totalQuantity: 10,
      reorderAt: " 5 ",
    });
    assert.strictEqual(valid, true);
  });

  it("passes when unitCost is 0", function () {
    const { valid } = validateProductForm({
      name: "Item B",
      totalQuantity: 1,
      unitCost: 0,
    });
    assert.strictEqual(valid, true);
  });

  it("passes when name is exactly 100 characters", function () {
    const { valid } = validateProductForm({
      name: "A".repeat(100),
      totalQuantity: 5,
    });
    assert.strictEqual(valid, true);
  });

  it("passes when assignments sum matches totalQuantity", function () {
    const { valid } = validateProductForm({
      name: "Bolts",
      totalQuantity: 10,
      assignments: [
        { locationId: "shelf-a1", quantity: 6 },
        { locationId: "shelf-a2", quantity: 4 },
      ],
    });
    assert.strictEqual(valid, true);
  });

  it("passes when totalQuantity is numeric string", function () {
    const { valid } = validateProductForm({
      name: "Item",
      totalQuantity: "10",
    });
    assert.strictEqual(valid, true);
  });

  it("passes when totalQuantity is whitespace numeric string", function () {
    const { valid } = validateProductForm({
      name: "Item",
      totalQuantity: " 10 ",
    });
    assert.strictEqual(valid, true);
  });


  it("fails when name is missing", function () {
    const { valid, errors } = validateProductForm({
      totalQuantity: 5,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.name);
  });

  it("fails when name is empty string", function () {
    const { valid, errors } = validateProductForm({
      name: "",
      totalQuantity: 5,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.name);
  });

  it("fails when name is only whitespace", function () {
    const { valid, errors } = validateProductForm({
      name: "   ",
      totalQuantity: 5,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.name);
  });

  it("fails when name exceeds 100 characters", function () {
    const { valid, errors } = validateProductForm({
      name: "A".repeat(101),
      totalQuantity: 5,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.name);
  });

  it("fails when name is null", function () {
    const { valid, errors } = validateProductForm({
      name: null,
      totalQuantity: 5,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.name);
  });


  it("fails when totalQuantity is missing", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.totalQuantity);
  });

  it("fails when totalQuantity is null", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: null,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.totalQuantity);
  });

  it("fails when totalQuantity is empty string", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: "",
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.totalQuantity);
  });

  it("fails when totalQuantity is negative", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: -1,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.totalQuantity);
  });

  it("fails when totalQuantity is a decimal", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 4.5,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.totalQuantity);
  });

  it("fails when totalQuantity is a non-numeric string", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: "many",
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.totalQuantity);
  });


  it("fails when reorderAt is negative", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      reorderAt: -1,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.reorderAt);
  });

  it("fails when reorderAt is a decimal", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      reorderAt: 2.5,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.reorderAt);
  });

  it("fails when reorderAt is a non-numeric string", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      reorderAt: "abc",
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.reorderAt);
  });


  it("fails when unitCost is negative", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      unitCost: -1,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.unitCost);
  });

  it("fails when unitCost is a non-numeric string", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      unitCost: "abc",
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.unitCost);
  });


  it("fails when assignments is an empty array", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      assignments: [],
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.assignments);
  });

  it("fails when assignments is not an array", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      assignments: "shelf-a1",
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.assignments);
  });

  it("fails when assignments contains zero quantity entry", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 10,
      assignments: [{ locationId: "shelf-a1", quantity: 0 }],
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.assignments);
  });

  it("fails when assignments contains negative quantity entry", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      assignments: [{ locationId: "shelf-a1", quantity: -5 }],
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.assignments);
  });

  it("fails when assignments do not sum to totalQuantity", function () {
    const { valid, errors } = validateProductForm({
      name: "Bolts",
      totalQuantity: 10,
      assignments: [{ locationId: "shelf-a1", quantity: 5 }],
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.assignments);
  });

  it("passes when single assignment matches totalQuantity exactly", function () {
    const { valid } = validateProductForm({
      name: "Bolts",
      totalQuantity: 5,
      assignments: [{ locationId: "shelf-a1", quantity: 5 }],
    });
    assert.strictEqual(valid, true);
  });


  it("returns multiple errors when several fields are invalid", function () {
    const { valid, errors } = validateProductForm({
      name: "",
      totalQuantity: -3,
      unitCost: -1,
    });
    assert.strictEqual(valid, false);
    assert.ok(errors.name);
    assert.ok(errors.totalQuantity);
    assert.ok(errors.unitCost);
  });
});