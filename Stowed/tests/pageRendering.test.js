import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter, StaticRouter } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { AlertsPage } from "../imports/ui/pages/AlertsPage";
import { ForecastPage } from "../imports/ui/pages/ForecastPage";
import { ListsPage } from "../imports/ui/pages/ListsPage";
import { QRCodesPage } from "../imports/ui/pages/QRCodesPage";
import { DashboardPage } from "../imports/ui/pages/DashboardPage";
import { InventoryListPage } from "../imports/ui/pages/InventoryListPage";
import { LocationsPage } from "../imports/ui/pages/LocationsPage";
import { LocationHierarchy } from "../imports/ui/pages/locationComponents/LocationHierarchy";
import { buildLocationHierarchy } from "../imports/ui/pages/locationComponents/buildLocationHierarchy";
import { ProductActivities, Products, ProductRecords } from "../imports/api/products/collections";
import { ProductCategories } from "../imports/api/categories/collections";
import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from "../imports/api/locations/collections";
import { ShoppingLists } from "../imports/api/shoppingLists/collections";
import { ROLES } from "../imports/api/roles";

function renderWithRouter(element, initialEntry = "/") {
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, { initialEntries: [initialEntry] }, element),
  );
}

function stubMeteor({ role, username = "Alex", userId = "user-id" }) {
  const original = {
    subscribe: Meteor.subscribe,
    user: Meteor.user,
    userId: Meteor.userId,
  };

  Meteor.subscribe = () => ({ ready: () => true });
  Meteor.user = () => (role == null ? null : { profile: { role, username } });
  Meteor.userId = () => (role == null ? null : userId);

  return () => {
    Meteor.subscribe = original.subscribe;
    Meteor.user = original.user;
    Meteor.userId = original.userId;
  };
}

function stubCollectionFind(collection, results) {
  const originalFind = collection.find;
  const originalFindOne = collection.findOne;
  collection.find = () => ({ fetch: () => results });
  if (typeof originalFindOne === "function") {
    collection.findOne = () => results[0] || null;
  }
  return () => {
    collection.find = originalFind;
    if (typeof originalFindOne === "function") {
      collection.findOne = originalFindOne;
    }
  };
}

function anchorWithClass(html, className) {
  // Attribute order in the rendered markup is an implementation detail of
  // react-router's Link, so match the tag and inspect it rather than assuming.
  const match = html.match(new RegExp(`<a[^>]*class="${className}"[^>]*>`));
  return match ? match[0] : "";
}

describe("location hierarchy construction", function () {
  it("sorts every level, calculates counts, and omits orphaned children", function () {
    const hierarchy = buildLocationHierarchy(
      [
        { _id: "site-z", name: "Zed Campus" },
        { _id: "site-a", name: "Clayton Campus" },
      ],
      [
        { _id: "floor-z", siteId: "site-a", name: "Upper Floor" },
        { _id: "orphan-floor", siteId: "missing-site", name: "Orphan Floor" },
        { _id: "floor-a", siteId: "site-a", name: "Ground Floor" },
      ],
      [
        { _id: "unit-z", floorMapId: "floor-a", name: "Rack B" },
        { _id: "unit-a", floorMapId: "floor-a", name: "Cabinet A" },
        { _id: "orphan-unit", floorMapId: "missing-floor", name: "Orphan Unit" },
      ],
      [
        { _id: "loc-z", storageUnitId: "unit-a", name: "Shelf B" },
        { _id: "loc-a", storageUnitId: "unit-a", name: "Shelf A1" },
        { _id: "orphan-location", storageUnitId: "missing-unit", name: "Orphan Location" },
      ],
    );

    assert.deepStrictEqual(
      hierarchy.map(({ site }) => site.name),
      ["Clayton Campus", "Zed Campus"],
    );
    assert.deepStrictEqual(
      hierarchy[0].floors.map(({ floorMap }) => floorMap.name),
      ["Ground Floor", "Upper Floor"],
    );
    assert.deepStrictEqual(
      hierarchy[0].floors[0].units.map(({ unit }) => unit.name),
      ["Cabinet A", "Rack B"],
    );
    assert.deepStrictEqual(
      hierarchy[0].floors[0].units[0].locations.map(({ name }) => name),
      ["Shelf A1", "Shelf B"],
    );
    assert.deepStrictEqual(
      [hierarchy[0].floorCount, hierarchy[0].unitCount, hierarchy[0].locationCount],
      [2, 2, 2],
    );
    assert.deepStrictEqual(
      [hierarchy[1].floorCount, hierarchy[1].unitCount, hierarchy[1].locationCount],
      [0, 0, 0],
    );
  });

  it("leaves empty parent levels intact", function () {
    const hierarchy = buildLocationHierarchy(
      [{ _id: "site-1", name: "Clayton" }],
      [{ _id: "floor-1", siteId: "site-1", name: "Ground Floor" }],
      [{ _id: "unit-1", floorMapId: "floor-1", name: "Cabinet A" }],
      [],
    );
    assert.strictEqual(hierarchy[0].floors[0].units[0].locationCount, 0);
    assert.deepStrictEqual(hierarchy[0].floors[0].units[0].locations, []);
  });

  it("renders collapsed sites and a clear empty hierarchy state", function () {
    const props = {
      sites: [{ _id: "site-1", name: "Clayton Campus" }],
      floorMaps: [{ _id: "floor-1", siteId: "site-1", name: "Ground Floor" }],
      storageUnits: [],
      storageLocations: [],
      loading: false,
    };
    const html = renderToStaticMarkup(
      React.createElement(
        StaticRouter,
        { location: "/" },
        React.createElement(LocationHierarchy, props),
      ),
    );
    assert.ok(html.includes("Clayton Campus"));
    assert.ok(html.includes("1 floor · 0 units · 0 locations"));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(!html.includes("Ground Floor"));

    const emptyHtml = renderToStaticMarkup(
      React.createElement(
        StaticRouter,
        { location: "/" },
        React.createElement(LocationHierarchy, { ...props, sites: [] }),
      ),
    );
    assert.ok(emptyHtml.includes("No location hierarchy yet."));
  });
});

describe("page rendering", function () {
  it("renders static tools and workspace pages", function () {
    // AlertsPage is data-driven (useTracker + Meteor.subscribe), so stub the
    // subscription and the collections it reads. Empty data is fine here - the
    // assertions only check the static page chrome.
    const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
    const restores = [
      stubCollectionFind(StorageLocations, []),
      stubCollectionFind(StorageUnits, []),
      stubCollectionFind(FloorMaps, []),
      stubCollectionFind(Sites, []),
      stubCollectionFind(Products, []),
      stubCollectionFind(ProductRecords, []),
      stubCollectionFind(ShoppingLists, []),
    ];

    try {
      const alerts = renderWithRouter(React.createElement(AlertsPage));
      const forecast = renderToStaticMarkup(React.createElement(ForecastPage));
      const lists = renderWithRouter(React.createElement(ListsPage));
      const qrCodes = renderWithRouter(React.createElement(QRCodesPage));

      assert.ok(alerts.includes("Stock"));
      assert.ok(alerts.includes("Alerts"));
      assert.ok(forecast.includes("Demand"));
      assert.ok(forecast.includes("Forecast"));
      assert.ok(lists.includes("Shopping"));
      assert.ok(lists.includes("Lists"));
      assert.ok(qrCodes.includes("QR"));
    } finally {
      restores.reverse().forEach((restore) => restore());
      restoreMeteor();
    }
  });

  if (Meteor.isClient) {
    it("renders the tabbed location directory with physical paths", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreSites = stubCollectionFind(Sites, [
        { _id: "site-1", name: "Clayton", stocktakeIntervalDays: 30 },
      ]);
      const restoreFloorMaps = stubCollectionFind(FloorMaps, [
        { _id: "map-1", siteId: "site-1", name: "Ground Floor" },
      ]);
      const restoreUnits = stubCollectionFind(StorageUnits, [
        { _id: "unit-1", floorMapId: "map-1", name: "Cabinet A" },
      ]);
      const restoreLocations = stubCollectionFind(StorageLocations, [
        {
          _id: "location-1",
          storageUnitId: "unit-1",
          name: "Shelf 1",
          code: "SC-A1",
          lastStocktakeAt: new Date(),
        },
      ]);
      const restoreRecords = stubCollectionFind(ProductRecords, [
        { _id: "record-1", locationId: "location-1", productId: "product-1", quantity: 2 },
      ]);

      try {
        const html = renderWithRouter(React.createElement(LocationsPage));

        assert.ok(html.includes("Storage Locations"));
        assert.ok(html.includes("Floor Maps"));
        assert.ok(html.includes("Sites"));
        assert.ok(html.includes("Hierarchy"));
        assert.ok(html.includes("Shelf 1"));
        assert.ok(html.includes("SC-A1"));
        assert.ok(html.includes("Clayton › Ground Floor › Cabinet A"));
        assert.ok(html.includes("+ Add location"));
      } finally {
        restoreRecords();
        restoreLocations();
        restoreUnits();
        restoreFloorMaps();
        restoreSites();
        restoreMeteor();
      }
    });

    it("selects the hierarchy URL without an add action for admin or standard users", function () {
      const restoreSites = stubCollectionFind(Sites, [{ _id: "site-1", name: "Clayton" }]);
      const restoreFloorMaps = stubCollectionFind(FloorMaps, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreRecords = stubCollectionFind(ProductRecords, []);

      try {
        for (const role of [ROLES.ADMIN, ROLES.STANDARD]) {
          const restoreMeteor = stubMeteor({ role });
          try {
            const html = renderWithRouter(
              React.createElement(LocationsPage),
              "/locations?tab=hierarchy",
            );
            assert.match(html, /<button[^>]*aria-selected="true"[^>]*>Hierarchy/);
            assert.ok(html.includes("Clayton"));
            assert.ok(!html.includes("+ Add hierarchy"));
            assert.ok(!html.includes("+ Add site"));
            assert.ok(!html.includes("+ Add location"));
          } finally {
            restoreMeteor();
          }
        }

        const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
        try {
          for (const tab of ["floor-maps", "sites", "invalid"]) {
            const html = renderWithRouter(
              React.createElement(LocationsPage),
              `/locations?tab=${tab}`,
            );
            const label =
              tab === "floor-maps" ? "Floor Maps" : tab === "sites" ? "Sites" : "Storage Locations";
            assert.match(html, new RegExp(`<button[^>]*aria-selected="true"[^>]*>${label}`));
          }
        } finally {
          restoreMeteor();
        }
      } finally {
        restoreRecords();
        restoreLocations();
        restoreUnits();
        restoreFloorMaps();
        restoreSites();
      }
    });

    it("expands hierarchy branches independently and shows navigation and empty states", function () {
      const container = globalThis.document.createElement("div");
      globalThis.document.body.appendChild(container);
      const root = createRoot(container);
      try {
        act(() => {
          root.render(
            React.createElement(
              MemoryRouter,
              null,
              React.createElement(LocationHierarchy, {
                sites: [
                  { _id: "site-1", name: "Clayton Campus" },
                  { _id: "site-2", name: "Caulfield Campus" },
                ],
                floorMaps: [
                  { _id: "floor-1", siteId: "site-1", name: "Ground Floor" },
                  { _id: "floor-2", siteId: "site-1", name: "Empty Floor" },
                ],
                storageUnits: [
                  { _id: "unit-1", floorMapId: "floor-1", name: "Cabinet A" },
                  { _id: "unit-2", floorMapId: "floor-1", name: "Empty Cabinet" },
                ],
                storageLocations: [
                  { _id: "loc-1", storageUnitId: "unit-1", name: "Shelf A1", code: "A1" },
                ],
                loading: false,
              }),
            ),
          );
        });

        const toggle = (level, id) =>
          container.querySelector(`[aria-controls="location-hierarchy-${level}-${id}"]`);
        const click = (button) =>
          act(() => button.dispatchEvent(new globalThis.MouseEvent("click", { bubbles: true })));

        assert.strictEqual(toggle("site", "site-1").getAttribute("aria-expanded"), "false");
        click(toggle("site", "site-1"));
        assert.strictEqual(toggle("site", "site-1").getAttribute("aria-expanded"), "true");
        assert.ok(container.textContent.includes("Ground Floor"));
        assert.ok(container.textContent.includes("Empty Floor"));
        click(toggle("site", "site-2"));
        assert.strictEqual(toggle("site", "site-1").getAttribute("aria-expanded"), "true");
        assert.ok(container.textContent.includes("No floors in this site"));
        click(toggle("floor", "floor-1"));
        click(toggle("unit", "unit-1"));
        assert.ok(container.textContent.includes("Shelf A1"));
        assert.ok(container.querySelector('a[href="/floor-map/floor-1"]'));
        assert.ok(container.querySelector('a[href="/locations/unit/unit-1"]'));
        assert.ok(container.querySelector('a[href="/locations/loc-1"]'));
        click(toggle("unit", "unit-2"));
        assert.ok(container.textContent.includes("No storage locations in this unit"));
        click(toggle("floor", "floor-2"));
        assert.ok(container.textContent.includes("No storage units on this floor"));
      } finally {
        act(() => root.unmount());
        container.remove();
      }
    });

    it("renders dashboard inventory data", function () {
      const items = [
        {
          _id: "hammer",
          name: "Hammer",
          totalQuantity: 10,
          reorderAt: 4,
          unitCost: 3,
          photoUrl: "https://example.com/hammer.png",
          updatedAt: new Date("2026-08-10T00:00:00.000Z"),
          updatedByUsername: "Jordan",
        },
        {
          _id: "gloves",
          name: "Gloves",
          totalQuantity: 2,
          reorderAt: 3,
          unitCost: 5,
          photoUrl: "https://example.com/gloves.png",
          updatedAt: new Date("2026-08-12T00:00:00.000Z"),
          updatedByUsername: "Alex",
        },
      ];
      const activities = [
        {
          _id: "activity-stocktake",
          orgId: "org-1",
          productId: "gloves",
          productName: "Gloves",
          action: "stocktake",
          actorUsername: "Alex",
          quantityBefore: 5,
          quantityAfter: 2,
          locationName: "Warehouse shelf",
          createdAt: new Date("2026-08-12T00:00:00.000Z"),
        },
        {
          _id: "activity-restock",
          orgId: "org-1",
          productId: "hammer",
          productName: "Hammer",
          action: "restocked",
          actorUsername: "Jordan",
          quantityBefore: 4,
          quantityAfter: 10,
          createdAt: new Date("2026-08-10T00:00:00.000Z"),
        },
        ...Array.from({ length: 10 }, (_, index) => ({
          _id: `activity-update-${index + 1}`,
          orgId: "org-1",
          productId: "hammer",
          productName: `Activity product ${index + 1}`,
          action: "updated",
          actorUsername: "Alex",
          createdAt: new Date(Date.UTC(2026, 7, 9 - index)),
        })),
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.STANDARD });
      const restoreProducts = stubCollectionFind(Products, items);
      const restoreActivities = stubCollectionFind(ProductActivities, activities);
      const restoreSites = stubCollectionFind(Sites, [
        { _id: "site-1", name: "Clayton", stocktakeIntervalDays: 30 },
      ]);
      const restoreFloorMaps = stubCollectionFind(FloorMaps, [
        { _id: "map-1", siteId: "site-1", name: "Ground Floor" },
      ]);
      const restoreUnits = stubCollectionFind(StorageUnits, [
        { _id: "unit-1", floorMapId: "map-1", name: "Cabinet A" },
      ]);
      const restoreLocations = stubCollectionFind(StorageLocations, [
        {
          _id: "location-1",
          storageUnitId: "unit-1",
          name: "Warehouse shelf",
          lastStocktakeAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      ]);

      try {
        const html = renderWithRouter(React.createElement(DashboardPage));

        assert.ok(html.includes("Dashboard"));
        assert.ok(html.includes("Hello, <em>Alex</em>"));
        assert.ok(html.includes("Customise"));
        assert.ok(!html.includes("Browse inventory"));
        assert.ok(!html.includes("Find a location"));
        assert.ok(html.includes("Inventory snapshot"));
        assert.ok(html.includes("Units on hand"));
        assert.ok(html.includes("12"));
        assert.ok(html.includes("Products"));
        assert.ok(html.includes("Storage locations"));
        assert.ok(html.includes("Storage units"));
        assert.ok(html.includes("/floor-map"));
        assert.ok(!html.includes("Total value"));
        assert.ok(html.includes("Low stock"));
        assert.ok(html.includes("1"));
        assert.ok(html.includes("Hammer"));
        assert.ok(html.includes("Gloves"));
        assert.ok(html.includes("Stocktake attention"));
        assert.ok(html.includes("Warehouse shelf"));
        assert.ok(html.includes("overdue"));
        assert.ok(html.includes("1 item needs attention"));
        assert.ok(html.includes("2 remaining"));
        assert.ok(html.includes("Min. 3"));
        assert.ok(html.includes("/inventory?filter=low-stock"));
        assert.ok(html.includes("Recent activity"));
        assert.ok(html.includes("Showing 10 of 12 latest actions"));
        assert.ok(html.includes('aria-label="Recent inventory activity"'));
        assert.ok(html.includes("Show 2 more"));
        assert.ok(html.includes("2 remaining"));
        assert.ok(html.includes("Activity product 8"));
        assert.ok(!html.includes("Activity product 9"));
        assert.ok(html.includes("Stocktake adjustment −3 units"));
        assert.ok(html.includes("Restocked +6 units"));
        assert.ok(html.includes("Warehouse shelf"));
        assert.ok(html.includes("5 → 2"));
        assert.ok(html.includes("2026-08-12T00:00:00.000Z"));
        assert.ok(html.includes("by Alex"));
        assert.ok(html.includes("View inventory"));
      } finally {
        restoreLocations();
        restoreUnits();
        restoreFloorMaps();
        restoreSites();
        restoreActivities();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("shows create and delete actions for admin inventory list", function () {
      const items = [
        {
          _id: "bolt",
          name: "Bolts",
          totalQuantity: 12,
          reorderAt: 10,
        },
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, items);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));

        assert.ok(html.includes("+ Add product"));
        assert.ok(html.includes("Delete selected"));
        assert.ok(html.includes("Bolts"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("leads the location column with the largest holding, not the first record", function () {
      const items = [
        {
          _id: "bolt",
          name: "Bolts",
          totalQuantity: 60,
          reorderAt: 10,
        },
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, items);
      // Deliberately ordered so the biggest holding is neither first nor last.
      const restoreRecords = stubCollectionFind(ProductRecords, [
        { _id: "r1", productId: "bolt", locationId: "loc-small", quantity: 5 },
        { _id: "r2", productId: "bolt", locationId: "loc-big", quantity: 50 },
        { _id: "r3", productId: "bolt", locationId: "loc-mid", quantity: 5 },
      ]);
      const restoreLocations = stubCollectionFind(StorageLocations, [
        { _id: "loc-small", storageUnitId: "unit-1", name: "Shelf 1" },
        { _id: "loc-big", storageUnitId: "unit-1", name: "Shelf 2" },
        { _id: "loc-mid", storageUnitId: "unit-1", name: "Shelf 3" },
      ]);
      const restoreUnits = stubCollectionFind(StorageUnits, [
        { _id: "unit-1", name: "Warehouse A" },
      ]);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));

        assert.ok(html.includes("Warehouse A · Shelf 2"));
        assert.ok(!html.includes("Warehouse A · Shelf 1"));
        assert.ok(html.includes("and 2 other locations"));

        // The overflow count links through to the product, where the full
        // per-location breakdown lives.
        assert.ok(anchorWithClass(html, "item-location-more").includes('href="/inventory/bolt"'));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("says No locations when a product is not stored anywhere", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, [
        { _id: "bolt", name: "Bolts", totalQuantity: 0, reorderAt: 10 },
      ]);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));
        assert.ok(html.includes("No locations"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("says No locations when every record points at a deleted location", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, [
        { _id: "bolt", name: "Bolts", totalQuantity: 4, reorderAt: 10 },
      ]);
      const restoreRecords = stubCollectionFind(ProductRecords, [
        { _id: "r1", productId: "bolt", locationId: "gone", quantity: 4 },
      ]);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));
        assert.ok(html.includes("No locations"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("gives every row a view-more link to the product", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, [
        { _id: "bolt", name: "Bolts", totalQuantity: 12, reorderAt: 10 },
        { _id: "nut", name: "Nuts", totalQuantity: 9, reorderAt: 2 },
      ]);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));

        const viewLinks = html.match(/<a[^>]*class="item-view-more"[^>]*>/g) || [];
        assert.strictEqual(viewLinks.length, 2);
        assert.ok(viewLinks[0].includes('href="/inventory/bolt"'));
        assert.ok(viewLinks[1].includes('href="/inventory/nut"'));
        assert.ok(html.includes("View more"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("pluralises a single other location", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, [
        { _id: "nut", name: "Nuts", totalQuantity: 9, reorderAt: 2 },
      ]);
      const restoreRecords = stubCollectionFind(ProductRecords, [
        { _id: "r1", productId: "nut", locationId: "loc-small", quantity: 2 },
        { _id: "r2", productId: "nut", locationId: "loc-big", quantity: 7 },
      ]);
      const restoreLocations = stubCollectionFind(StorageLocations, [
        { _id: "loc-small", storageUnitId: "unit-1", name: "Shelf 1" },
        { _id: "loc-big", storageUnitId: "unit-1", name: "Shelf 2" },
      ]);
      const restoreUnits = stubCollectionFind(StorageUnits, [
        { _id: "unit-1", name: "Warehouse A" },
      ]);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));

        assert.ok(html.includes("and 1 other location"));
        assert.ok(!html.includes("and 1 other locations"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("hides privileged actions for standard inventory list", function () {
      const items = [
        {
          _id: "washer",
          name: "Washers",
          totalQuantity: 30,
          reorderAt: 5,
        },
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.STANDARD });
      const restoreProducts = stubCollectionFind(Products, items);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));

        assert.ok(!html.includes("+ Add product"));
        assert.ok(!html.includes("Delete selected"));
        assert.ok(html.includes("Washers"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("applies the low-stock inventory filter from the URL", function () {
      const items = [
        {
          _id: "paper",
          name: "Printer Paper",
          totalQuantity: 2,
          reorderAt: 5,
        },
        {
          _id: "pens",
          name: "Pens",
          totalQuantity: 20,
          reorderAt: 5,
        },
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.STANDARD });
      const restoreProducts = stubCollectionFind(Products, items);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        const html = renderWithRouter(
          React.createElement(InventoryListPage),
          "/inventory?filter=low-stock",
        );

        assert.ok(html.includes("Printer Paper"));
        assert.ok(!html.includes(">Pens<"));
        assert.ok(html.includes("1 of 2 products shown"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("shows the category name for a product's categoryId", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, [
        { _id: "bolt", name: "Bolts", totalQuantity: 12, reorderAt: 2, categoryId: "cat-1" },
      ]);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);
      const restoreCategories = stubCollectionFind(ProductCategories, [
        { _id: "cat-1", orgId: "org-1", name: "Fasteners" },
        { _id: "cat-2", orgId: "org-1", name: "Cleaning" },
      ]);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));

        assert.ok(html.includes("<span>Category</span>"));
        assert.ok(html.includes('class="item-category">Fasteners<'));
        assert.ok(!html.includes("Cleaning"));
      } finally {
        restoreCategories();
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("falls back to a dash when a product has no resolvable category", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, [
        { _id: "bolt", name: "Bolts", totalQuantity: 12, reorderAt: 2 },
        { _id: "nut", name: "Nuts", totalQuantity: 9, reorderAt: 2, categoryId: "deleted" },
      ]);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);
      const restoreCategories = stubCollectionFind(ProductCategories, [
        { _id: "cat-1", orgId: "org-1", name: "Fasteners" },
      ]);

      try {
        const html = renderWithRouter(React.createElement(InventoryListPage));

        // No category pill for either row, and no stale category name.
        assert.ok(!html.includes('class="item-category"'));
        assert.ok(!html.includes("Fasteners"));
      } finally {
        restoreCategories();
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("applies the out of stock filter from the url", function () {
      const items = [
        { _id: "paper", name: "Printer Paper", totalQuantity: 0, reorderAt: 10 },
        { _id: "pens", name: "Pens", totalQuantity: 20, reorderAt: 5 },
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.STANDARD });
      const restoreProducts = stubCollectionFind(Products, items);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        const html = renderWithRouter(
          React.createElement(InventoryListPage),
          "/inventory?filter=out-of-stock",
        );

        assert.ok(html.includes("Printer Paper"));
        assert.ok(!html.includes(">Pens<"));
        assert.ok(html.includes("1 of 2 products shown"));
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });

    it("accepts every rendered filter chip as a url filter", function () {
      // The guard that validates ?filter= is built from the same list the chips
      // render from, so a chip can never be unreachable through the URL.
      const items = [{ _id: "pens", name: "Pens", totalQuantity: 20, reorderAt: 5 }];
      const restoreMeteor = stubMeteor({ role: ROLES.STANDARD });
      const restoreProducts = stubCollectionFind(Products, items);
      const restoreRecords = stubCollectionFind(ProductRecords, []);
      const restoreLocations = stubCollectionFind(StorageLocations, []);
      const restoreUnits = stubCollectionFind(StorageUnits, []);

      try {
        // The selected chip is the only one rendered without a border.
        const selectedChip = (html) =>
          (html.match(/<button[^>]*>(?:(?!<\/button>).)*<\/button>/g) || []).find((btn) =>
            btn.includes("border:none"),
          );

        [
          ["all", "All"],
          ["low-stock", "Low stock"],
          ["out-of-stock", "Out of stock"],
          ["location", "Location"],
        ].forEach(([id, label]) => {
          const html = renderWithRouter(
            React.createElement(InventoryListPage),
            `/inventory?filter=${id}`,
          );
          const chip = selectedChip(html);
          assert.ok(chip, `no chip rendered as selected for ${id}`);
          assert.ok(chip.includes(`>${label}`), `${id} fell back to another chip: ${chip}`);
        });
      } finally {
        restoreUnits();
        restoreLocations();
        restoreRecords();
        restoreProducts();
        restoreMeteor();
      }
    });
  }
});
