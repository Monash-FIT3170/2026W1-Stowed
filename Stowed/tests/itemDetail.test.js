import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getMockItemDetailById,
  mockItemDetails,
} from "../imports/api/mockItemDetails";
import { ItemDetailView } from "../imports/ui/pages/ItemDetailPage";

describe("item detail", function () {
  it("returns mock item details by id", function () {
    assert.ok(mockItemDetails.length > 0);

    mockItemDetails.forEach((expectedItem) => {
      const actualItem = getMockItemDetailById(expectedItem._id);
      assert.deepStrictEqual(actualItem, expectedItem);
    });
  });

  it("renders photo, quality, and location on item detail view", function () {
    assert.ok(mockItemDetails.length > 0);
    mockItemDetails.forEach((item) => {
      const html = renderToStaticMarkup(
        React.createElement(ItemDetailView, { item }),
      );

      assert.ok(html.includes("img"));
      assert.ok(html.includes(item.photoUrl));
      assert.ok(html.includes("Quality:"));
      assert.ok(html.includes(item.quality));
      assert.ok(html.includes("Location:"));
      assert.ok(html.includes(item.location));
    });
  });

  it("renders not found state when item does not exist", function () {
    const html = renderToStaticMarkup(
      React.createElement(ItemDetailView, { item: undefined }),
    );

    assert.ok(html.includes("Item not found."));
  });
});
