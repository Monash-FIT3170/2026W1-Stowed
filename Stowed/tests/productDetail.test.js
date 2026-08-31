import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { mockProducts, getMockProductById } from "../imports/api/mockProducts";
import { ProductDetailView } from "../imports/ui/pages/ProductDetailPage";

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
