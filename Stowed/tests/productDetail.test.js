import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { mockProducts, getMockProductById } from "../imports/api/mockProducts";
import { ProductDetailView } from "../imports/ui/pages/ProductDetailPage";

function renderWithoutLayoutEffectWarning(element) {
  const originalError = console.error;

  console.error = (...args) => {
    if (
      String(args[0]).includes("useLayoutEffect does nothing on the server")
    ) {
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
      if (item.status && item.status.includes("CRITICAL")) {
        assert.ok(html.includes("Low stock") || html.includes("Low stock"));
      } else {
        assert.ok(html.includes("In stock") || html.includes("In stock"));
      }

      // operational fields
      assert.ok(html.includes("Reorder at"));
      assert.ok(html.includes("Current stock") || html.includes("in stock"));
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

    const firstImg =
      (item.catalogImages && item.catalogImages[0]) || item.photoUrl;
    if (firstImg) {
      assert.ok(html.includes(firstImg));
      assert.ok(html.includes("main-image"));
      assert.ok(html.includes("thumbnail-gallery"));
    }
  });
});
