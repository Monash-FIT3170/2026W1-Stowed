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
import { Products, ProductRecords } from "../imports/api/products/collections";
import {
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
