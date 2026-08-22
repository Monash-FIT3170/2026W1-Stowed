import assert from "assert";
import {
  describeStocktakeTiming,
  getLocationStocktakeStatus,
  getStocktakeAlerts,
  isValidStocktakeInterval,
  STOCKTAKE_STATUS,
} from "../imports/api/locations/stocktake";

describe("Locations page stocktake status", function () {
  const now = new Date("2026-08-10T00:00:00.000Z");

  it("marks a location overdue after its site interval", function () {
    assert.strictEqual(
      getLocationStocktakeStatus(new Date("2026-07-01T00:00:00.000Z"), 30, now),
      "overdue",
    );
  });

  it("marks a location due soon within fourteen days", function () {
    assert.strictEqual(
      getLocationStocktakeStatus(new Date("2026-07-20T00:00:00.000Z"), 30, now),
      "due-soon",
    );
  });

  it("marks a location current before the due-soon window", function () {
    assert.strictEqual(
      getLocationStocktakeStatus(new Date("2026-08-01T00:00:00.000Z"), 30, now),
      "ok",
    );
  });

  it("accepts stocktake intervals from 1 to 3650 whole days", function () {
    assert.strictEqual(isValidStocktakeInterval(1), true);
    assert.strictEqual(isValidStocktakeInterval(180), true);
    assert.strictEqual(isValidStocktakeInterval(3650), true);
  });

  it("rejects invalid stocktake intervals", function () {
    assert.strictEqual(isValidStocktakeInterval(0), false);
    assert.strictEqual(isValidStocktakeInterval(3651), false);
    assert.strictEqual(isValidStocktakeInterval(1.5), false);
    assert.strictEqual(isValidStocktakeInterval("30"), false);
  });

  it("derives and orders location alerts from the physical hierarchy", function () {
    const alerts = getStocktakeAlerts({
      sites: [{ _id: "site-1", name: "Clayton", stocktakeIntervalDays: 30 }],
      floorMaps: [{ _id: "map-1", siteId: "site-1", name: "Ground Floor" }],
      storageUnits: [{ _id: "unit-1", floorMapId: "map-1", name: "Cabinet A" }],
      storageLocations: [
        {
          _id: "overdue-10",
          storageUnitId: "unit-1",
          name: "Shelf B",
          lastStocktakeAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          _id: "overdue-40",
          storageUnitId: "unit-1",
          name: "Shelf A",
          lastStocktakeAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          _id: "due-soon",
          storageUnitId: "unit-1",
          name: "Shelf C",
          lastStocktakeAt: new Date("2026-07-20T00:00:00.000Z"),
        },
        {
          _id: "current",
          storageUnitId: "unit-1",
          name: "Shelf D",
          lastStocktakeAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
      now,
    });

    assert.deepStrictEqual(
      alerts.map((alert) => alert.location._id),
      ["overdue-40", "overdue-10", "due-soon"],
    );
    assert.strictEqual(alerts[0].path, "Clayton › Ground Floor › Cabinet A");
    assert.strictEqual(alerts[0].intervalDays, 30);
  });

  it("can limit shared stocktake alerts to overdue locations", function () {
    const alerts = getStocktakeAlerts({
      sites: [{ _id: "site-1", stocktakeIntervalDays: 30 }],
      floorMaps: [{ _id: "map-1", siteId: "site-1" }],
      storageUnits: [{ _id: "unit-1", floorMapId: "map-1" }],
      storageLocations: [
        {
          _id: "overdue",
          storageUnitId: "unit-1",
          lastStocktakeAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          _id: "due-soon",
          storageUnitId: "unit-1",
          lastStocktakeAt: new Date("2026-07-20T00:00:00.000Z"),
        },
      ],
      now,
      statuses: [STOCKTAKE_STATUS.OVERDUE],
    });

    assert.deepStrictEqual(
      alerts.map((alert) => alert.location._id),
      ["overdue"],
    );
  });

  it("describes shared stocktake timing consistently", function () {
    assert.strictEqual(describeStocktakeTiming(-12), "12 days overdue");
    assert.strictEqual(describeStocktakeTiming(-1), "1 day overdue");
    assert.strictEqual(describeStocktakeTiming(0), "Due today");
    assert.strictEqual(describeStocktakeTiming(3), "Due in 3 days");
  });
});
