import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductThumbnail } from "../imports/ui/components/ProductThumbnail";
import { ProductThumbnail as InventoryListThumbnail } from "../imports/ui/pages/InventoryListPage";

describe("product thumbnails", function () {
  it("uses the first images entry for the shared thumbnail component", function () {
    const html = renderToStaticMarkup(
      React.createElement(ProductThumbnail, {
        images: [
          "https://example.com/primary.png",
          "https://example.com/secondary.png",
        ],
        photoUrl: "https://example.com/fallback.png",
        name: "Hex bolts",
      }),
    );

    assert.ok(html.includes("https://example.com/primary.png"));
    assert.ok(html.includes("img"));
  });

  it("prefers images over photoUrl for inventory list thumbnails", function () {
    const html = renderToStaticMarkup(
      React.createElement(InventoryListThumbnail, {
        images: ["https://example.com/list-primary.png"],
        photoUrl: "https://example.com/list-fallback.png",
        catalogImages: ["https://example.com/list-catalog.png"],
        name: "Safety Helmet",
      }),
    );

    assert.ok(html.includes("https://example.com/list-primary.png"));
    assert.ok(html.includes("img"));
  });

  it("falls back to catalog images when no images or photoUrl are set", function () {
    const html = renderToStaticMarkup(
      React.createElement(InventoryListThumbnail, {
        images: [],
        photoUrl: "",
        catalogImages: ["https://example.com/catalog.png"],
        name: "Work Gloves",
      }),
    );

    assert.ok(html.includes("https://example.com/catalog.png"));
    assert.ok(html.includes("img"));
  });

  it("renders initials when no thumbnail source is available", function () {
    const html = renderToStaticMarkup(
      React.createElement(InventoryListThumbnail, {
        images: [],
        photoUrl: "",
        catalogImages: [],
        name: "Steel Toe",
      }),
    );

    assert.ok(html.includes("ST"));
    assert.ok(!html.includes("img"));
  });
});
