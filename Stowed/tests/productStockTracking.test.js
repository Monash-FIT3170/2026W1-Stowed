import assert from "assert";

// ---------------------------------------------------------------------------
// Pure stock tracking logic — mirrors the quantity/reorderAt calculations
// used across the products methods and inventory list view.
// ---------------------------------------------------------------------------

function isLowStock(totalQuantity, reorderAt) {
  if (typeof totalQuantity !== "number" || typeof reorderAt !== "number") return false;
  if (reorderAt <= 0) return false;
  return totalQuantity <= reorderAt;
}

function getLowStockItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => isLowStock(item.totalQuantity, item.reorderAt));
}

function mergeAssignments(assignments) {
  if (!Array.isArray(assignments)) return [];
  const map = new Map();
  for (const { locationId, quantity } of assignments) {
    map.set(locationId, (map.get(locationId) ?? 0) + quantity);
  }
  return Array.from(map.entries()).map(([locationId, quantity]) => ({ locationId, quantity }));
}

function assignedMatchesTotal(assignments, totalQuantity) {
  const sum = assignments.reduce((acc, a) => acc + a.quantity, 0);
  return sum === totalQuantity;
}

describe("productStockTracking - isLowStock()", function () {
  it("returns true when totalQuantity equals reorderAt", function () {
    assert.strictEqual(isLowStock(25, 25), true);
  });

  it("returns true when totalQuantity is below reorderAt", function () {
    assert.strictEqual(isLowStock(4, 25), true);
  });

  it("returns false when totalQuantity is above reorderAt", function () {
    assert.strictEqual(isLowStock(47, 25), false);
  });

  it("returns false when totalQuantity is exactly one above reorderAt", function () {
    assert.strictEqual(isLowStock(26, 25), false);
  });

  it("returns false when reorderAt is 0 (no threshold set)", function () {
    assert.strictEqual(isLowStock(0, 0), false);
  });

  it("returns false when reorderAt is not a number", function () {
    assert.strictEqual(isLowStock(5, null), false);
  });

  it("returns false when totalQuantity is not a number", function () {
    assert.strictEqual(isLowStock(null, 10), false);
  });
});

describe("productStockTracking - getLowStockItems()", function () {
  const items = [
    { _id: "1", name: "Hex bolts",     totalQuantity: 4,  reorderAt: 25 },
    { _id: "2", name: "Pine planks",   totalQuantity: 47, reorderAt: 60 },
    { _id: "3", name: "Adj wrench",    totalQuantity: 23, reorderAt: 30 },
    { _id: "4", name: "LED bulbs E27", totalQuantity: 50, reorderAt: 30 },
    { _id: "5", name: "Garden hose",   totalQuantity: 7,  reorderAt: 20 },
    { _id: "6", name: "No threshold",  totalQuantity: 3,  reorderAt: 0  },
  ];

  it("returns items at or below their reorderAt threshold", function () {
    const ids = getLowStockItems(items).map((i) => i._id);
    assert.ok(ids.includes("1"), "hex bolts should be low");
    assert.ok(ids.includes("2"), "pine planks should be low");
    assert.ok(ids.includes("3"), "adj wrench should be low");
    assert.ok(ids.includes("5"), "garden hose should be low");
  });

  it("excludes items above their reorderAt threshold", function () {
    const ids = getLowStockItems(items).map((i) => i._id);
    assert.ok(!ids.includes("4"), "LED bulbs should not be low");
  });

  it("excludes items with reorderAt of 0", function () {
    const ids = getLowStockItems(items).map((i) => i._id);
    assert.ok(!ids.includes("6"), "item with reorderAt=0 should not appear");
  });

  it("returns empty array for empty input", function () {
    assert.deepStrictEqual(getLowStockItems([]), []);
  });

  it("returns empty array for non-array input", function () {
    assert.deepStrictEqual(getLowStockItems(null), []);
  });
});

describe("productStockTracking - mergeAssignments()", function () {
  it("merges duplicate locationIds by summing quantities", function () {
    const result = mergeAssignments([
      { locationId: "shelf-a1", quantity: 7 },
      { locationId: "shelf-a1", quantity: 6 },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].quantity, 13);
  });

  it("leaves distinct locationIds unchanged", function () {
    const result = mergeAssignments([
      { locationId: "shelf-a1", quantity: 5 },
      { locationId: "shelf-a2", quantity: 3 },
    ]);
    assert.strictEqual(result.length, 2);
  });

  it("returns empty array for empty input", function () {
    assert.deepStrictEqual(mergeAssignments([]), []);
  });

  it("returns empty array for non-array input", function () {
    assert.deepStrictEqual(mergeAssignments(null), []);
  });
});

describe("productStockTracking - assignedMatchesTotal()", function () {
  it("returns true when assignments sum equals totalQuantity", function () {
    const assignments = [
      { locationId: "shelf-a1", quantity: 6 },
      { locationId: "shelf-a2", quantity: 4 },
    ];
    assert.strictEqual(assignedMatchesTotal(assignments, 10), true);
  });

  it("returns false when assignments sum is less than totalQuantity", function () {
    const assignments = [{ locationId: "shelf-a1", quantity: 5 }];
    assert.strictEqual(assignedMatchesTotal(assignments, 10), false);
  });

  it("returns false when assignments sum is greater than totalQuantity", function () {
    const assignments = [{ locationId: "shelf-a1", quantity: 15 }];
    assert.strictEqual(assignedMatchesTotal(assignments, 10), false);
  });

  it("returns true when a single assignment equals totalQuantity", function () {
    const assignments = [{ locationId: "shelf-a1", quantity: 10 }];
    assert.strictEqual(assignedMatchesTotal(assignments, 10), true);
  });
});

describe("productStockTracking - isLowStock() edge cases", function () {
  it("returns false when both inputs are undefined", function () {
    assert.strictEqual(isLowStock(undefined, undefined), false);
  });

  it("returns false when reorderAt is negative", function () {
    assert.strictEqual(isLowStock(5, -5), false);
  });

  it("returns false when both totalQuantity and reorderAt are 0", function () {
    assert.strictEqual(isLowStock(0, 0), false);
  });
});

describe("productStockTracking - getLowStockItems() edge cases", function () {
  it("returns all items when all are low stock", function () {
    const items = [
      { _id: "1", name: "Item A", totalQuantity: 2, reorderAt: 5 },
      { _id: "2", name: "Item B", totalQuantity: 1, reorderAt: 10 },
    ];
    const result = getLowStockItems(items);
    assert.strictEqual(result.length, 2);
  });

  it("returns empty array when all items are healthy", function () {
    const items = [
      { _id: "1", name: "Item A", totalQuantity: 50, reorderAt: 5 },
      { _id: "2", name: "Item B", totalQuantity: 100, reorderAt: 10 },
    ];
    const result = getLowStockItems(items);
    assert.deepStrictEqual(result, []);
  });

  it("excludes item missing reorderAt field entirely", function () {
    const items = [
      { _id: "1", name: "Item A", totalQuantity: 5 },
    ];
    const result = getLowStockItems(items);
    assert.deepStrictEqual(result, []);
  });
});

// --- mergeAssignments() additional edge cases ---

describe("productStockTracking - mergeAssignments() edge cases", function () {
  it("merges three or more entries with the same locationId", function () {
    const result = mergeAssignments([
      { locationId: "shelf-a1", quantity: 3 },
      { locationId: "shelf-a1", quantity: 4 },
      { locationId: "shelf-a1", quantity: 5 },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].quantity, 12);
  });

  it("handles entry with quantity 0", function () {
    const result = mergeAssignments([
      { locationId: "shelf-a1", quantity: 0 },
      { locationId: "shelf-a1", quantity: 5 },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].quantity, 5);
  });
});

// --- assignedMatchesTotal() additional edge cases ---

describe("productStockTracking - assignedMatchesTotal() edge cases", function () {
  it("returns true when assignments is empty and totalQuantity is 0", function () {
    assert.strictEqual(assignedMatchesTotal([], 0), true);
  });

  it("returns false when assignments is empty and totalQuantity is greater than 0", function () {
    assert.strictEqual(assignedMatchesTotal([], 10), false);
  });
});