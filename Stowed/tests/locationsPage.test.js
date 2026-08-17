import assert from "assert";
import {
  getLocationStocktakeStatus,
  isValidStocktakeInterval,
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
});
