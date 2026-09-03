import assert from "assert";
import {
  quantityFor,
  toExplicitItem,
  isLowStock,
  allocateWithinBudget,
} from "../imports/api/shoppingLists/generation";
import {
  ADD_PRODUCT_MODES,
  BUDGET_STRATEGIES,
  LIST_FREQUENCIES,
} from "../imports/api/shoppingLists/constants";


describe("quantityFor", function () {
  it("scales the shortfall by the number of weeks the frequency covers", function () {
    const product = { totalQuantity: 2, reorderAt: 10, lowStockThreshold: 0 };
    assert.strictEqual(quantityFor(product, LIST_FREQUENCIES.WEEKLY), 8);
    assert.strictEqual(quantityFor(product, LIST_FREQUENCIES.FORTNIGHTLY), 16);
    assert.strictEqual(quantityFor(product, LIST_FREQUENCIES.MONTHLY), 32);
  });

  it("uses the larger of reorderAt and lowStockThreshold as the target", function () {
    const product = { totalQuantity: 1, reorderAt: 3, lowStockThreshold: 9 };
    assert.strictEqual(quantityFor(product, LIST_FREQUENCIES.WEEKLY), 8);
  });

  it("never asks for less than one unit, even when stock is above target", function () {
    const product = { totalQuantity: 50, reorderAt: 10 };
    assert.strictEqual(quantityFor(product, LIST_FREQUENCIES.WEEKLY), 1);
  });

  it("falls back to a single week for an unknown frequency", function () {
    const product = { totalQuantity: 0, reorderAt: 5 };
    assert.strictEqual(quantityFor(product, "quarterly"), 5);
  });
});

describe("toExplicitItem", function () {
  const product = {
    _id: "p1",
    name: "Nitrile gloves",
    categoryId: "cat-ppe",
    totalQuantity: 4,
    reorderAt: 12,
    lowStockThreshold: 6,
    purchaseCost: 3.5,
    unitCost: 9.99,
  };

  it("snapshots current product data with the requested quantity", function () {
    assert.deepStrictEqual(toExplicitItem(product, 20), {
      productId: "p1",
      productName: "Nitrile gloves",
      categoryId: "cat-ppe",
      inStock: 4,
      reorderAt: 12,
      lowStockThreshold: 6,
      unitCost: 3.5,
      quantityWanted: 20,
      addMode: ADD_PRODUCT_MODES.MANUAL,
      purchased: false,
      received: false,
    });
  });

  it("prefers purchaseCost over unitCost for the line cost", function () {
    assert.strictEqual(toExplicitItem(product, 1).unitCost, 3.5);
    assert.strictEqual(toExplicitItem({ ...product, purchaseCost: undefined }, 1).unitCost, 9.99);
  });

  it("defaults missing optional fields", function () {
    assert.deepStrictEqual(toExplicitItem({ _id: "p2", name: "Bare" }, 5), {
      productId: "p2",
      productName: "Bare",
      categoryId: "",
      inStock: 0,
      reorderAt: 0,
      lowStockThreshold: 0,
      unitCost: 0,
      quantityWanted: 5,
      addMode: ADD_PRODUCT_MODES.MANUAL,
      purchased: false,
      received: false,
    });
  });
});

describe("isLowStock", function () {
  it("is true when stock is at or below the reorder point", function () {
    assert.strictEqual(isLowStock({ totalQuantity: 5, reorderAt: 5 }), true);
    assert.strictEqual(isLowStock({ totalQuantity: 0, reorderAt: 5 }), true);
  });

  it("is false when stock is above the reorder point", function () {
    assert.strictEqual(isLowStock({ totalQuantity: 6, reorderAt: 5 }), false);
  });

  it("is false when the product has no numeric reorder point", function () {
    assert.strictEqual(isLowStock({ totalQuantity: 0 }), false);
    assert.strictEqual(isLowStock({ totalQuantity: 0, reorderAt: null }), false);
  });

  it("treats a missing quantity as zero", function () {
    assert.strictEqual(isLowStock({ reorderAt: 1 }), true);
  });
});

describe("allocateWithinBudget", function () {
  const cheap = { _id: "cheap", name: "Cheap", totalQuantity: 0, reorderAt: 2, purchaseCost: 1 };
  const mid = { _id: "mid", name: "Mid", totalQuantity: 0, reorderAt: 2, purchaseCost: 5 };
  const dear = { _id: "dear", name: "Dear", totalQuantity: 0, reorderAt: 2, purchaseCost: 20 };
  const opts = (overrides) => ({
    frequency: LIST_FREQUENCIES.WEEKLY,
    strategy: BUDGET_STRATEGIES.MAX_PRODUCTS,
    budgetCents: null,
    ...overrides,
  });

  it("includes every product and reports no remaining budget when there is no budget", function () {
    const result = allocateWithinBudget([cheap, mid, dear], opts({ budgetCents: null }));
    assert.strictEqual(result.items.length, 3);
    assert.deepStrictEqual(result.skipped, []);
    assert.strictEqual(result.remainingCents, null);
    assert.strictEqual(result.spentCents, 5200);
  });

  it("MAX_PRODUCTS takes whole shortfalls cheapest-line first and skips what will not fit", function () {
    const result = allocateWithinBudget([dear, mid, cheap], opts({ budgetCents: 1500 }));
    assert.deepStrictEqual(
      result.items.map((i) => i.productId),
      ["cheap", "mid"],
    );
    assert.deepStrictEqual(
      result.skipped.map((p) => p._id),
      ["dear"],
    );
    assert.strictEqual(result.spentCents, 1200);
    assert.strictEqual(result.remainingCents, 300);
  });

  it("SPREAD seeds one unit of each affordable product before topping up", function () {

    const result = allocateWithinBudget(
      [cheap, mid, dear],
      opts({
        strategy: BUDGET_STRATEGIES.SPREAD,
        budgetCents: 900,
      }),
    );
    const wanted = Object.fromEntries(result.items.map((i) => [i.productId, i.quantityWanted]));
    assert.strictEqual(wanted.cheap, 2);
    assert.strictEqual(wanted.mid, 1);
    assert.strictEqual(wanted.dear, undefined);
    assert.strictEqual(result.spentCents, 700);
    assert.strictEqual(result.remainingCents, 200);
  });

  it("URGENT orders by proportional depletion, most urgent first", function () {
    const nearlyOut = { _id: "a", name: "A", totalQuantity: 1, reorderAt: 10, purchaseCost: 1 };
    const halfDown = { _id: "b", name: "B", totalQuantity: 5, reorderAt: 10, purchaseCost: 1 };
    const result = allocateWithinBudget(
      [halfDown, nearlyOut],
      opts({
        strategy: BUDGET_STRATEGIES.URGENT,
        budgetCents: 100000,
      }),
    );
    assert.deepStrictEqual(
      result.items.map((i) => i.productId),
      ["a", "b"],
    );
  });

  it("breaks ties by product _id so regenerating twice gives the same list", function () {
    const p1 = { _id: "zzz", name: "Z", totalQuantity: 0, reorderAt: 1, purchaseCost: 2 };
    const p2 = { _id: "aaa", name: "A", totalQuantity: 0, reorderAt: 1, purchaseCost: 2 };
    const first = allocateWithinBudget([p1, p2], opts({ budgetCents: 100000 }));
    const second = allocateWithinBudget([p2, p1], opts({ budgetCents: 100000 }));
    assert.deepStrictEqual(
      first.items.map((i) => i.productId),
      ["aaa", "zzz"],
    );
    assert.deepStrictEqual(
      first.items.map((i) => i.productId),
      second.items.map((i) => i.productId),
    );
  });
});
