import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FilterChips } from "../imports/ui/components/FilterChips";
import {
  searchProducts,
  filterLowStock,
  filterByStorageUnit,
} from "../imports/api/products/filters";
import { mockProducts } from "../imports/api/mockProducts";

describe("product search", function () {
  it("returns all products when query is empty", function () {
    const result = searchProducts(mockProducts, "");
    assert.strictEqual(result.length, mockProducts.length);
  });

  it("returns all products when query is whitespace only", function () {
    const result = searchProducts(mockProducts, "   ");
    assert.strictEqual(result.length, mockProducts.length);
  });

  it("matches by full name", function () {
    const result = searchProducts(mockProducts, "Safety Helmet");
    assert.ok(result.some((p) => p.name === "Safety Helmet"));
  });

  it("matches a partial name", function () {
    const result = searchProducts(mockProducts, "helmet");
    assert.ok(result.some((p) => p.name === "Safety Helmet"));
  });

  it("matches by SKU", function () {
    const result = searchProducts(mockProducts, "BAT-AAA-4");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "AAA Battery Pack");
  });

  it("matches by description", function () {
    const result = searchProducts(mockProducts, "alkaline");
    assert.ok(result.some((p) => p._id === "1"));
  });

  it("matches by product ID", function () {
    const result = searchProducts(mockProducts, "2");
    assert.ok(result.some((p) => p._id === "2"));
  });

  it("returns an empty array when nothing matches", function () {
    const result = searchProducts(mockProducts, "nonexistent product xyz");
    assert.strictEqual(result.length, 0);
  });

  it("is case insensitive", function () {
    const lower = searchProducts(mockProducts, "helmet");
    const upper = searchProducts(mockProducts, "HELMET");
    const mixed = searchProducts(mockProducts, "Helmet");
    assert.strictEqual(lower.length, upper.length);
    assert.strictEqual(lower.length, mixed.length);
    assert.ok(lower.length > 0);
  });
});

describe("low stock filter", function () {
  it("includes products where totalQuantity equals reorderAt", function () {
    const products = [{ _id: "a", totalQuantity: 10, reorderAt: 10 }];
    assert.strictEqual(filterLowStock(products).length, 1);
  });

  it("includes products where totalQuantity is below reorderAt", function () {
    const products = [{ _id: "a", totalQuantity: 2, reorderAt: 10 }];
    assert.strictEqual(filterLowStock(products).length, 1);
  });

  it("excludes products where totalQuantity is above reorderAt", function () {
    const products = [{ _id: "a", totalQuantity: 50, reorderAt: 10 }];
    assert.strictEqual(filterLowStock(products).length, 0);
  });

  it("excludes products where reorderAt is null", function () {
    const products = [{ _id: "a", totalQuantity: 1, reorderAt: null }];
    assert.strictEqual(filterLowStock(products).length, 0);
  });

  it("excludes products where reorderAt is undefined", function () {
    const products = [{ _id: "a", totalQuantity: 1 }];
    assert.strictEqual(filterLowStock(products).length, 0);
  });

  it("returns only the matching subset from a mixed list", function () {
    const products = [
      { _id: "a", totalQuantity: 1, reorderAt: 10 },
      { _id: "b", totalQuantity: 100, reorderAt: 10 },
      { _id: "c", totalQuantity: 5, reorderAt: 5 },
      { _id: "d", totalQuantity: 5, reorderAt: null },
    ];
    const result = filterLowStock(products);
    const ids = result.map((p) => p._id).sort();
    assert.deepStrictEqual(ids, ["a", "c"]);
  });
});

describe("location filter", function () {
  const storageLocations = [
    { _id: "loc1", storageUnitId: "unitA", name: "Shelf 1" },
    { _id: "loc2", storageUnitId: "unitA", name: "Shelf 2" },
    { _id: "loc3", storageUnitId: "unitB", name: "Bay 1" },
  ];

  const productRecords = [
    { productId: "p1", locationId: "loc1" },
    { productId: "p2", locationId: "loc2" },
    { productId: "p3", locationId: "loc3" },
    { productId: "p4", locationId: "loc3" },
  ];

  const products = [
    { _id: "p1", name: "Item 1" },
    { _id: "p2", name: "Item 2" },
    { _id: "p3", name: "Item 3" },
    { _id: "p4", name: "Item 4" },
  ];

  it("returns all products when no unit id is provided", function () {
    const result = filterByStorageUnit(products, productRecords, storageLocations, "");
    assert.strictEqual(result.length, products.length);
  });

  it("returns only products stored in the chosen unit", function () {
    const result = filterByStorageUnit(products, productRecords, storageLocations, "unitA");
    const ids = result.map((p) => p._id).sort();
    assert.deepStrictEqual(ids, ["p1", "p2"]);
  });

  it("returns multiple products sharing a single location", function () {
    const result = filterByStorageUnit(products, productRecords, storageLocations, "unitB");
    const ids = result.map((p) => p._id).sort();
    assert.deepStrictEqual(ids, ["p3", "p4"]);
  });

  it("returns an empty array when no products are stored in the unit", function () {
    const result = filterByStorageUnit(products, productRecords, storageLocations, "unitC");
    assert.strictEqual(result.length, 0);
  });

  it("does not include products with no matching record", function () {
    const orphanProducts = [...products, { _id: "p5", name: "Item 5" }];
    const result = filterByStorageUnit(orphanProducts, productRecords, storageLocations, "unitA");
    assert.ok(!result.some((p) => p._id === "p5"));
  });
});

describe("filter chips", function () {
  const filters = [
    { id: "all", label: "All", count: 8 },
    { id: "low-stock", label: "Low stock", count: 3 },
    { id: "tag", label: "Tag" },
    { id: "location", label: "Location" },
  ];

  it("renders a button for every filter", function () {
    const html = renderToStaticMarkup(
      React.createElement(FilterChips, {
        filters,
        activeFilter: "all",
        onFilterChange: () => {},
      })
    );
    const buttonCount = (html.match(/<button/g) || []).length;
    assert.strictEqual(buttonCount, filters.length);
  });

  it("renders every filter label", function () {
    const html = renderToStaticMarkup(
      React.createElement(FilterChips, {
        filters,
        activeFilter: "all",
        onFilterChange: () => {},
      })
    );
    filters.forEach((f) => {
      assert.ok(html.includes(f.label));
    });
  });

  it("renders counts when provided", function () {
    const html = renderToStaticMarkup(
      React.createElement(FilterChips, {
        filters,
        activeFilter: "all",
        onFilterChange: () => {},
      })
    );
    assert.ok(html.includes(">8<"));
    assert.ok(html.includes(">3<"));
  });

  it("omits the count span when count is undefined", function () {
    const html = renderToStaticMarkup(
      React.createElement(FilterChips, {
        filters: [{ id: "tag", label: "Tag" }],
        activeFilter: "tag",
        onFilterChange: () => {},
      })
    );
    assert.ok(!html.includes("opacity:0.7"));
  });
});