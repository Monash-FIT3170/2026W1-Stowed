import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { mockItems, getMockItemById } from "../imports/api/mockItems";
import { ItemDetailView } from "../imports/ui/pages/ItemDetailPage";

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

describe("ItemDetailView", function () {
  it("renders not found when item is missing", function () {
    const html = renderWithoutLayoutEffectWarning(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ItemDetailView, { item: undefined }),
      ),
    );
    assert.ok(html.includes("Item not found."));
  });

  it("renders core item information and images", function () {
    assert.ok(mockItems.length > 0);

    mockItems.forEach((item) => {
      const html = renderWithoutLayoutEffectWarning(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(ItemDetailView, { item, productId: item._id }),
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
    const item = getMockItemById("1") || mockItems[0];
    const html = renderWithoutLayoutEffectWarning(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ItemDetailView, { item, productId: item._id }),
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
