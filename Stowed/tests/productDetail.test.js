import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { mockProducts, getMockProductById } from "../imports/api/mockProducts";
import { ProductDetailView } from "../imports/ui/pages/ProductDetailPage";
import {
  buildFloorMapPreviewModel,
  previewViewport,
} from "../imports/ui/pages/floorMapComponents/canvas/components/FloorMapPreview";

function renderWithoutLayoutEffectWarning(element) {
  const originalError = console.error;

  console.error = (...args) => {
    if (String(args[0]).includes("useLayoutEffect does nothing on the server")) {
      return;
    }

    originalError(...args);
  };

  try {
    return renderToStaticMarkup(element);
  } finally {
    console.error = originalError;
  }
}

function renderProduct(item) {
  return renderWithoutLayoutEffectWarning(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ProductDetailView, { item, productId: item._id }),
    ),
  );
}

function stockBadge(html) {
  const match = html.match(/<div class="product-status-badge ([a-z-]+)">([^<]+)<\/div>/);
  return match ? { state: match[1], label: match[2] } : null;
}

describe("ProductDetailView", function () {
  const mapFixtures = {
    sites: [
      { _id: "site-1", name: "Building 67" },
      { _id: "site-2", name: "Building 75" },
    ],
    floorMaps: [
      {
        _id: "floor-1",
        siteId: "site-1",
        name: "Ground Floor",
        floorSize: { width: 500, height: 300 },
      },
      { _id: "floor-2", siteId: "site-2", name: "Level 1", floorSize: { width: 400, height: 400 } },
    ],
    storageUnits: [
      {
        _id: "unit-a",
        floorMapId: "floor-1",
        name: "Shelf A",
        type: "shelf",
        shape: {
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 1 },
            { x: 0, y: 1 },
          ],
        },
        offset: { x: 2, y: 2 },
        scale: { x: 1, y: 1 },
      },
      {
        _id: "unit-b",
        floorMapId: "floor-1",
        name: "Shelf C",
        type: "shelf",
        shape: {
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 1 },
            { x: 0, y: 1 },
          ],
        },
        offset: { x: 6, y: 2 },
        scale: { x: 1, y: 1 },
      },
      {
        _id: "unit-c",
        floorMapId: "floor-2",
        name: "Cabinet B",
        type: "cabinet",
        shape: {
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 2 },
            { x: 0, y: 2 },
          ],
        },
        offset: { x: 3, y: 4 },
        scale: { x: 1, y: 1 },
      },
    ],
    storageLocations: [
      { _id: "loc-a", storageUnitId: "unit-a", name: "A-03" },
      { _id: "loc-b", storageUnitId: "unit-b", name: "C-01" },
      { _id: "loc-c", storageUnitId: "unit-c", name: "B-04" },
    ],
  };

  function renderLocatedProduct(locationIds, overrides = {}) {
    const item = { _id: "mapped-product", name: "Widget", sku: "W-1", totalQuantity: 12 };
    return renderWithoutLayoutEffectWarning(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProductDetailView, {
          item,
          productId: item._id,
          records: locationIds.map((locationId, index) => ({
            _id: `record-${index}`,
            locationId,
            quantity: index + 2,
          })),
          ...mapFixtures,
          ...overrides,
        }),
      ),
    );
  }

  describe("location map previews", function () {
    it("shows one mapped location and links to its highlighted full map", function () {
      const html = renderLocatedProduct(["loc-a"]);
      assert.strictEqual((html.match(/class="location-map-preview"/g) || []).length, 1);
      assert.ok(html.includes("Building 67 → Ground Floor → Shelf A → A-03"));
      assert.ok(html.includes('data-highlighted-unit="unit-a"'));
      assert.ok(html.includes("/floor-map/floor-1/detail?location=loc-a"));
      assert.ok(html.includes("Assigned stock"));
    });

    it("shows each location across floors with the matching unit", function () {
      const html = renderLocatedProduct(["loc-a", "loc-b", "loc-c"]);
      assert.strictEqual((html.match(/class="location-map-preview"/g) || []).length, 3);
      const disclosures = html.match(/<details\b[^>]*>/g) || [];
      assert.strictEqual(disclosures.length, 3);
      assert.ok(disclosures[0].includes('open=""'));
      assert.ok(disclosures.slice(1).every((element) => !element.includes("open=")));
      assert.strictEqual((html.match(/<summary\b/g) || []).length, 3);
      assert.ok(html.includes("Show map") && html.includes("Hide map"));
      assert.ok(html.includes('data-highlighted-unit="unit-a"'));
      assert.ok(html.includes('data-highlighted-unit="unit-b"'));
      assert.ok(html.includes('data-highlighted-unit="unit-c"'));
      assert.ok(html.includes("/floor-map/floor-1/detail?location=loc-b"));
      assert.ok(html.includes("/floor-map/floor-2/detail?location=loc-c"));
      assert.ok(html.includes("Building 75 → Level 1 → Cabinet B → B-04"));
    });

    it("opens the first mapped location when an earlier location has no map", function () {
      const html = renderLocatedProduct(["missing-location", "loc-a"]);
      const disclosures = html.match(/<details\b[^>]*>/g) || [];
      assert.strictEqual(disclosures.length, 1);
      assert.ok(disclosures[0].includes('open=""'));
      assert.ok(html.includes("Map preview unavailable for this location."));
    });

    it("combines duplicate records for the same storage location", function () {
      const html = renderLocatedProduct(["loc-a", "loc-a"]);
      assert.strictEqual((html.match(/class="location-map-preview"/g) || []).length, 1);
      assert.ok(html.includes('class="storage-location-quantity">5</div>'));
    });

    it("handles no locations and preserves the product details", function () {
      const html = renderLocatedProduct([]);
      assert.ok(html.includes("No stock assigned to a storage location yet."));
      assert.ok(html.includes("Widget"));
      assert.ok(html.includes("Current stock"));
      assert.ok(!html.includes("location-map-preview"));
    });

    it("keeps text and uses a compact fallback when map geometry is missing", function () {
      const storageUnits = mapFixtures.storageUnits.map((unit) =>
        unit._id === "unit-a" ? { ...unit, offset: undefined } : unit,
      );
      const html = renderLocatedProduct(["loc-a"], { storageUnits });
      assert.ok(html.includes("Building 67 → Ground Floor → Shelf A → A-03"));
      assert.ok(html.includes("Map preview unavailable for this location."));
      assert.ok(!html.includes("location-map-preview"));
    });

    it("falls back when a floor has no configured map size", function () {
      const floorMaps = mapFixtures.floorMaps.map((floorMap) =>
        floorMap._id === "floor-1" ? { ...floorMap, floorSize: undefined } : floorMap,
      );
      const html = renderLocatedProduct(["loc-a"], { floorMaps });
      assert.ok(html.includes("Building 67 → Ground Floor → Shelf A → A-03"));
      assert.ok(html.includes("Map preview unavailable for this location."));
      assert.ok(!html.includes("location-map-preview"));
    });

    it("falls back when a storage unit is positioned outside its floor", function () {
      const storageUnits = mapFixtures.storageUnits.map((unit) =>
        unit._id === "unit-a" ? { ...unit, offset: { x: 50, y: 50 } } : unit,
      );
      const html = renderLocatedProduct(["loc-a"], { storageUnits });
      assert.ok(html.includes("Map preview unavailable for this location."));
      assert.ok(!html.includes("location-map-preview"));
    });

    it("uses the existing read-only map layers and focuses on the selected unit", function () {
      const model = buildFloorMapPreviewModel(mapFixtures.floorMaps[0], mapFixtures.storageUnits);
      assert.deepStrictEqual(
        model.units.map((unit) => unit.id),
        ["unit-a", "unit-b"],
      );
      const viewport = previewViewport(model, "unit-b", 320, 200);
      assert.strictEqual(viewport.unit.id, "unit-b");
      assert.ok(viewport.scale > 0);
      assert.ok(Number.isFinite(viewport.x) && Number.isFinite(viewport.y));
      const html = renderLocatedProduct(["loc-b"]);
      assert.ok(html.includes('role="img"'));
      assert.ok(!html.includes("Map zoom controls"));
      assert.ok(!html.includes("Layout editor"));
    });
  });

  it("renders not found when product is missing", function () {
    const html = renderWithoutLayoutEffectWarning(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProductDetailView, { item: undefined }),
      ),
    );
    assert.ok(html.includes("Product not found."));
  });

  it("renders core product information and images", function () {
    assert.ok(mockProducts.length > 0);

    mockProducts.forEach((item) => {
      const html = renderWithoutLayoutEffectWarning(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(ProductDetailView, { item, productId: item._id }),
        ),
      );

      // basic identity
      assert.ok(html.includes(item.name));
      assert.ok(html.includes(item.sku));
      assert.ok(html.includes(item.location));

      // header image and main image
      if (item.photoUrl) {
        assert.ok(html.includes(item.photoUrl));
      }

      // status badge text
      const stock = item.currentStock ?? item.totalQuantity ?? 0;
      const expected =
        stock <= 0
          ? "Out of stock"
          : item.reorderAt != null && stock <= item.reorderAt
            ? "Low stock"
            : "In stock";
      assert.strictEqual(stockBadge(html).label, expected);

      // operational fields
      assert.ok(html.includes("Reorder at"));
      assert.ok(html.includes("Current stock") || html.includes("in stock"));
    });
  });

  describe("stock status badge", function () {
    const base = {
      _id: "p1",
      name: "Widget",
      sku: "SKU-1",
      location: "Shelf 1",
    };

    it("is red and out of stock at zero, whatever the threshold", function () {
      assert.deepStrictEqual(
        stockBadge(renderProduct({ ...base, currentStock: 0, reorderAt: 5 })),
        {
          state: "out-of-stock",
          label: "Out of stock",
        },
      );
      assert.deepStrictEqual(
        stockBadge(renderProduct({ ...base, currentStock: 0, reorderAt: null })),
        { state: "out-of-stock", label: "Out of stock" },
      );
    });

    it("is orange and low at or below the reorder quantity", function () {
      assert.deepStrictEqual(
        stockBadge(renderProduct({ ...base, currentStock: 5, reorderAt: 5 })),
        {
          state: "low-stock",
          label: "Low stock",
        },
      );
      assert.deepStrictEqual(
        stockBadge(renderProduct({ ...base, currentStock: 1, reorderAt: 5 })),
        {
          state: "low-stock",
          label: "Low stock",
        },
      );
    });

    it("is green and in stock above the reorder quantity", function () {
      assert.deepStrictEqual(
        stockBadge(renderProduct({ ...base, currentStock: 6, reorderAt: 5 })),
        {
          state: "in-stock",
          label: "In stock",
        },
      );
      assert.deepStrictEqual(
        stockBadge(renderProduct({ ...base, currentStock: 3, reorderAt: null })),
        { state: "in-stock", label: "In stock" },
      );
    });

    it("ignores the legacy status field", function () {
      // Real products never carry `status`; a stale "CRITICAL" must not make a
      // well-stocked product look low.
      assert.deepStrictEqual(
        stockBadge(renderProduct({ ...base, currentStock: 80, reorderAt: 10, status: "CRITICAL" })),
        { state: "in-stock", label: "In stock" },
      );
    });
  });

  describe("category field", function () {
    const base = {
      _id: "p1",
      name: "Widget",
      sku: "SKU-1",
      location: "Shelf 1",
    };

    function categoryInput(html) {
      const match = html.match(/<input id="category"[^>]*value="([^"]*)"/);
      return match ? match[1] : null;
    }

    it("resolves categoryId against the categories list", function () {
      const html = renderWithoutLayoutEffectWarning(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(ProductDetailView, {
            item: { ...base, categoryId: "c1" },
            productId: base._id,
            categories: [{ _id: "c1", name: "Lab Safety" }],
          }),
        ),
      );
      assert.strictEqual(categoryInput(html), "Lab Safety");
      assert.ok(!html.includes("No category specified"));
    });

    it("falls back to the placeholder when the category is unknown", function () {
      const html = renderProduct({ ...base, categoryId: "missing" });
      assert.strictEqual(categoryInput(html), "No category specified");
    });
  });

  it("selects first catalog image as main image when available", function () {
    const item = getMockProductById("1") || mockProducts[0];
    const html = renderWithoutLayoutEffectWarning(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProductDetailView, { item, productId: item._id }),
      ),
    );

    const firstImg = (item.catalogImages && item.catalogImages[0]) || item.photoUrl;
    if (firstImg) {
      assert.ok(html.includes(firstImg));
      assert.ok(html.includes("main-image"));
      assert.ok(html.includes("thumbnail-gallery"));
    }
  });
});
