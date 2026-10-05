import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { buildRectShape } from "../imports/api/locations/shapeUtils";
import { CustomerLocations } from "../imports/ui/pages/CustomerLocations";
import {
  publicHighlightedUnitId,
  selectCustomerFloorMap,
} from "../imports/ui/pages/CustomerFloorMapPage";
import { publicMaps } from "../imports/ui/pages/floorMapComponents/mapSelection";

const sites = [
  { _id: "site-a", name: "Main site" },
  { _id: "site-b", name: "Annex" },
];
const floorMaps = [
  { _id: "map-a", siteId: "site-a", name: "Ground Floor" },
  { _id: "map-b", siteId: "site-b", name: "Level 1", floorSize: { width: 500, height: 500 } },
  { _id: "map-private", siteId: "site-a", name: "Staff room", isPrivate: true },
];
const storageUnits = [
  { _id: "unit-a", floorMapId: "map-a", name: "Rack A", type: "rack", offset: { x: 1, y: 1 } },
  { _id: "unit-b", floorMapId: "map-b", name: "Shelf B", type: "shelf", offset: { x: 3, y: 2 } },
  {
    _id: "unit-private",
    floorMapId: "map-private",
    name: "Private shelf",
    type: "shelf",
    offset: { x: 1, y: 1 },
  },
].map((unit) => ({
  ...unit,
  shape: buildRectShape({ width: 2, height: 1 }),
  scale: { x: 1, y: 1 },
}));

function renderLocations(locations, overrides = {}) {
  const originalError = console.error;
  console.error = (...args) => {
    if (!String(args[0]).includes("useLayoutEffect does nothing on the server")) {
      originalError(...args);
    }
  };
  try {
    return renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(CustomerLocations, {
          locations,
          floorMaps,
          storageUnits,
          sites,
          mapsReady: true,
          ...overrides,
        }),
      ),
    );
  } finally {
    console.error = originalError;
  }
}

describe("customer location map previews", function () {
  it("shows a read-only preview and link for a public map without saved dimensions", function () {
    const html = renderLocations([{ unitId: "unit-a", label: "Rack A · Bay 1" }]);
    assert.ok(html.includes('data-highlighted-unit="unit-a"'));
    assert.ok(html.includes("Main site · Ground Floor"));
    assert.ok(html.includes("/customer/floor-map?map=map-a&amp;unit=unit-a"));
    assert.ok(html.includes('class="customer-detail-map-disclosure" open=""'));
    assert.ok(html.includes("Show map") && html.includes("Hide map"));
    assert.ok(!html.includes("Assigned stock"));
  });

  it("keeps multiple sites distinct and opens only the first preview initially", function () {
    const html = renderLocations([
      { unitId: "unit-a", label: "Rack A · Bay 1" },
      { unitId: "unit-b", label: "Shelf B · Bay 2" },
    ]);
    const disclosures = html.match(/<details\b[^>]*>/g) || [];
    assert.strictEqual(disclosures.length, 2);
    assert.ok(disclosures[0].includes('open=""'));
    assert.ok(!disclosures[1].includes("open="));
    assert.ok(html.includes("Main site · Ground Floor"));
    assert.ok(html.includes("Annex · Level 1"));
    assert.ok(html.includes("/customer/floor-map?map=map-b&amp;unit=unit-b"));
    assert.ok(html.includes("Best place to look"));
  });

  it("keeps a private or missing map textual and offers no map link", function () {
    const html = renderLocations([
      { unitId: "unit-private", label: "Private shelf · Bay 1" },
      { unitId: "missing-unit", label: "Unknown shelf" },
    ]);
    assert.ok(html.includes("Private shelf · Bay 1"));
    assert.strictEqual((html.match(/Map preview unavailable for this location/g) || []).length, 2);
    assert.ok(!html.includes("location-map-preview"));
    assert.ok(!html.includes("/customer/floor-map?"));
  });

  it("shows location text while public map data is loading", function () {
    const html = renderLocations([{ unitId: "unit-a", label: "Rack A · Bay 1" }], {
      floorMaps: [],
      storageUnits: [],
      mapsReady: false,
    });
    assert.ok(html.includes("Rack A · Bay 1"));
    assert.ok(!html.includes("Map preview unavailable"));
  });

  it("highlights only a unit on the selected public floor map", function () {
    assert.strictEqual(publicHighlightedUnitId("unit-a", "map-a", storageUnits), "unit-a");
    assert.strictEqual(publicHighlightedUnitId("unit-b", "map-a", storageUnits), null);
    assert.strictEqual(publicHighlightedUnitId("missing", "map-a", storageUnits), null);
  });

  it("uses the linked public map before a previously selected map", function () {
    const visible = publicMaps(floorMaps);
    assert.strictEqual(selectCustomerFloorMap(visible, "map-b", "map-a")._id, "map-a");
    assert.strictEqual(selectCustomerFloorMap(visible, "map-b", "map-private")._id, "map-a");
  });
});
