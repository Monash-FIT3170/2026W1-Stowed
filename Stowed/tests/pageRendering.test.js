import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { AlertsPage } from "../imports/ui/pages/AlertsPage";
import { ForecastPage } from "../imports/ui/pages/ForecastPage";
import { ListsPage } from "../imports/ui/pages/ListsPage";
import { QRCodesPage } from "../imports/ui/pages/QRCodesPage";
import { DashboardPage } from "../imports/ui/pages/DashboardPage";
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

describe("page rendering", function () {
  it("renders static tools and workspace pages", function () {
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
        },
        {
          _id: "gloves",
          name: "Gloves",
          totalQuantity: 2,
          reorderAt: 3,
          unitCost: 5,
          photoUrl: "https://example.com/gloves.png",
          updatedAt: new Date("2026-08-12T00:00:00.000Z"),
        },
      ];

      const restoreMeteor = stubMeteor({ role: ROLES.STANDARD });
      const restoreProducts = stubCollectionFind(Products, items);
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
        assert.ok(html.includes("Hello, Alex"));
        assert.ok(html.includes("Products tracked"));
        assert.ok(html.includes("2"));
        assert.ok(html.includes("Low stock"));
        assert.ok(html.includes("1"));
        assert.ok(html.includes("$40"));
        assert.ok(html.includes("Hammer"));
        assert.ok(html.includes("Gloves"));
        assert.ok(html.includes("Stocktake attention"));
        assert.ok(html.includes("Warehouse shelf"));
        assert.ok(html.includes("overdue"));
        assert.ok(html.includes("1 item needs attention"));
        assert.ok(html.includes("2 remaining"));
        assert.ok(html.includes("Min. 3"));
        assert.ok(html.includes("/inventory/list?filter=low-stock"));
        assert.ok(html.includes("Recently updated"));
        assert.ok(html.includes("10 in stock"));
        assert.ok(html.includes("2 in stock"));
        assert.ok(html.includes("2026-08-12T00:00:00.000Z"));
        assert.ok(html.includes("View inventory"));
      } finally {
        restoreLocations();
        restoreUnits();
        restoreFloorMaps();
        restoreSites();
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
          "/inventory/list?filter=low-stock",
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
  }
});
