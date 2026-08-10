import assert from "assert";
import { getLocationStocktakeStatus } from "../imports/ui/pages/LocationsPage";

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
});
