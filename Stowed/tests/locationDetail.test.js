import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LocationDetailView } from "../imports/ui/pages/LocationDetailPage";

function renderView(props) {
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(LocationDetailView, props)),
  );
}

describe("LocationDetailView", function () {
  const hierarchy = {
    location: {
      _id: "location-1",
      name: "Shelf 1",
      code: "SC-A1",
      lastStocktakeAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    unit: { _id: "unit-1", name: "Cabinet A", type: "cabinet" },
    floorMap: { _id: "map-1", name: "Ground Floor" },
    site: { _id: "site-1", name: "Clayton", stocktakeIntervalDays: 30 },
  };

  it("renders location hierarchy and associated product quantities", function () {
    const html = renderView({
      ...hierarchy,
      rows: [
        {
          record: { _id: "record-1", productId: "product-1", quantity: 8 },
          product: { _id: "product-1", name: "Safety Gloves", sku: "SAFE-01", totalQuantity: 20 },
        },
        {
          record: { _id: "record-2", productId: "product-2", quantity: 3 },
          product: { _id: "product-2", name: "Safety Goggles", sku: "SAFE-02", totalQuantity: 9 },
        },
      ],
    });

    assert.ok(html.includes("Shelf 1"));
    assert.ok(html.includes("SC-A1"));
    assert.ok(html.includes("Clayton › Ground Floor › Cabinet A"));
    assert.ok(html.includes("Safety Gloves"));
    assert.ok(html.includes("SAFE-01"));
    assert.ok(html.includes("Safety Goggles"));
    assert.ok(html.includes("Start stocktake"));
    assert.ok(html.includes("Total units"));
    assert.ok(html.includes(">11<"));
  });

  it("renders an empty inventory state", function () {
    const html = renderView({ ...hierarchy, rows: [] });
    assert.ok(html.includes("No products are currently assigned"));
  });

  it("renders a not-found state", function () {
    const html = renderView({ location: null });
    assert.ok(html.includes("Storage location not found"));
  });
});
