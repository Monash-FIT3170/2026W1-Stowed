import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductThumbnail } from "../imports/ui/components/ProductThumbnail";
import { mockProducts } from "../imports/api/mockProducts";

describe("item thumbnail", function () {
  it("renders an img tag when photoUrl is provided", function () {
    mockProducts.forEach((item) => {
      if (!item.photoUrl) return;
      const html = renderToStaticMarkup(
        React.createElement(ProductThumbnail, { photoUrl: item.photoUrl, name: item.name })
      );
      assert.ok(html.includes("img"));
      assert.ok(html.includes(item.photoUrl));
    });
  });

  it("renders initials fallback when no photoUrl is provided", function () {
    const html = renderToStaticMarkup(
      React.createElement(ProductThumbnail, { photoUrl: "", name: "Safety Helmet" })
    );
    assert.ok(!html.includes("img"));
    assert.ok(html.includes("SH"));
  });

  it("renders fallback for single word name", function () {
    const html = renderToStaticMarkup(
      React.createElement(ProductThumbnail, { photoUrl: "", name: "Gloves" })
    );
    assert.ok(html.includes("G"));
  });

  it("renders fallback when name is undefined", function () {
    const html = renderToStaticMarkup(
      React.createElement(ProductThumbnail, { photoUrl: "", name: undefined })
    );
    assert.ok(html.includes("?"));
  });
});
