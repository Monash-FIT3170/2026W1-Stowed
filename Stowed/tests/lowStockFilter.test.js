import assert from "assert";
import {
  mockLowStockItems,
  getLowStockItems,
} from "../imports/api/mockLowStockItem";

describe("low stock filter", function () {
  it("returns items below their low stock threshold", function () {
    const result = getLowStockItems(mockLowStockItems);
    const names = result.map((item) => item.name);
    assert.ok(names.includes("Safety Helmet"));
  });

  it("returns items exactly at their threshold", function () {
    const result = getLowStockItems(mockLowStockItems);
    const names = result.map((item) => item.name);
    assert.ok(names.includes("Work Gloves"));
  });

  it("includes items with zero quantity", function () {
    const result = getLowStockItems(mockLowStockItems);
    const names = result.map((item) => item.name);
    assert.ok(names.includes("Hard Hat Liner"));
  });

  it("excludes items above their threshold", function () {
    const result = getLowStockItems(mockLowStockItems);
    const names = result.map((item) => item.name);
    assert.ok(!names.includes("AAA Battery Pack"));
    assert.ok(!names.includes("Steel Toe Boots"));
  });

  it("returns empty array for non-array input", function () {
    assert.deepStrictEqual(getLowStockItems(null), []);
    assert.deepStrictEqual(getLowStockItems(undefined), []);
    assert.deepStrictEqual(getLowStockItems("not an array"), []);
  });

  it("returns empty array for empty input", function () {
    assert.deepStrictEqual(getLowStockItems([]), []);
  });

  it("ignores items missing quantity or threshold", function () {
    const malformedItems = [
      { _id: "x", name: "No Quantity", lowStockThreshold: 5 },
      { _id: "y", name: "No Threshold", quantity: 2 },
      { _id: "z", name: "Both Missing" },
    ];
    assert.deepStrictEqual(getLowStockItems(malformedItems), []);
  });

//   it("prints low stock items (visual check)", function () {
//     const result = getLowStockItems(mockLowStockItems);
//     console.log("\n--- Low stock items ---");
//     result.forEach(item => {
//       console.log(`${item.name}: ${item.quantity} units (threshold: ${item.lowStockThreshold})`);
//     });
//     console.log("-----------------------\n");
//     assert.ok(true);
//   });
});

