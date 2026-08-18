import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { AlertsPage } from "../imports/ui/pages/AlertsPage";
import { ForecastPage } from "../imports/ui/pages/ForecastPage";
import { ListsPage } from "../imports/ui/pages/ListsPage";
import { QRCodesPage } from "../imports/ui/pages/QRCodesPage";
import { InventoryPage } from "../imports/ui/pages/InventoryPage";
import { InventoryListPage } from "../imports/ui/pages/InventoryListPage";
import { LocationsPage } from "../imports/ui/pages/LocationsPage";
import { Products, ProductRecords } from "../imports/api/products/collections";
import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from "../imports/api/locations/collections";
import { ROLES } from "../imports/api/roles";

function renderWithRouter(element) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, element));
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

describe("page rendering", function () {
  it("renders static tools and workspace pages", function () {
    // AlertsPage is data-driven (useTracker + Meteor.subscribe), so stub the
    // subscription and the collections it reads. Empty data is fine here — the
    // assertions only check the static page chrome.
    const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
    const restores = [
      stubCollectionFind(StorageLocations, []),
      stubCollectionFind(StorageUnits, []),
      stubCollectionFind(FloorMaps, []),
      stubCollectionFind(Sites, []),
      stubCollectionFind(Products, []),
      stubCollectionFind(ProductRecords, []),
    ];

    try {
      const alerts = renderToStaticMarkup(React.createElement(AlertsPage));
      const forecast = renderToStaticMarkup(React.createElement(ForecastPage));
      const lists = renderToStaticMarkup(React.createElement(ListsPage));
      const qrCodes = renderToStaticMarkup(React.createElement(QRCodesPage));

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

    it("renders inventory dashboard data", function () {
      const items = [
        {
          _id: "hammer",
          name: "Hammer",
          totalQuantity: 10,
          reorderAt: 4,
          unitCost: 3,
          photoUrl: "https://example.com/hammer.png",
        },
        {
          _id: "gloves",
          name: "Gloves",
          totalQuantity: 2,
          reorderAt: 3,
          unitCost: 5,
          photoUrl: "https://example.com/gloves.png",
        },
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.STANDARD });
      const restoreProducts = stubCollectionFind(Products, items);

      try {
        const html = renderWithRouter(React.createElement(InventoryPage));

        assert.ok(html.includes("Hello, Alex"));
        assert.ok(html.includes("Products tracked"));
        assert.ok(html.includes("2"));
        assert.ok(html.includes("Low stock"));
        assert.ok(html.includes("1"));
        assert.ok(html.includes("$40"));
        assert.ok(html.includes("Hammer"));
        assert.ok(html.includes("Gloves"));
      } finally {
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
          tag: "fasteners",
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
          tag: "fasteners",
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

    it("gives every row a view-more link to the product", function () {
      const restoreMeteor = stubMeteor({ role: ROLES.ADMIN });
      const restoreProducts = stubCollectionFind(Products, [
        { _id: "bolt", name: "Bolts", totalQuantity: 12, reorderAt: 10, tag: "fasteners" },
        { _id: "nut", name: "Nuts", totalQuantity: 9, reorderAt: 2, tag: "fasteners" },
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
        { _id: "nut", name: "Nuts", totalQuantity: 9, reorderAt: 2, tag: "fasteners" },
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
          tag: "fasteners",
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
  }
});
