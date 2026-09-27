import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  buildStocktakeRows,
  summariseStocktakeRows,
  UnitStocktakePanelView,
} from "../imports/ui/pages/floorMapComponents/UnitStocktakePanel";
import { STOCKTAKE_STATUS } from "../imports/api/locations/stocktake";

const NOW = new Date("2026-08-18T00:00:00.000Z");
const INTERVAL_DAYS = 30;

/** Days back from NOW, so a fixture's status is stated by its offset. */
function countedDaysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

const LOCATIONS = {
  // 60 days on a 30 day interval - 30 days overdue.
  overdue: { _id: "loc-overdue", name: "Shelf A1", code: "A1", lastStocktakeAt: countedDaysAgo(60) },
  // 45 days on a 30 day interval - 15 days overdue, so less urgent than above.
  lessOverdue: { _id: "loc-older", name: "Shelf A2", lastStocktakeAt: countedDaysAgo(45) },
  // 25 days leaves 5 days, inside the 14 day due-soon window.
  dueSoon: { _id: "loc-due-soon", name: "Shelf B1", lastStocktakeAt: countedDaysAgo(25) },
  // 2 days leaves 28, comfortably current.
  ok: { _id: "loc-ok", name: "Shelf C1", lastStocktakeAt: countedDaysAgo(2) },
};

function renderPanel(props) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(UnitStocktakePanelView, { unitName: "Rack A", ...props }),
    ),
  );
}

describe("buildStocktakeRows", function () {
  it("classifies each location against the site's interval", function () {
    const rows = buildStocktakeRows(
      [LOCATIONS.ok, LOCATIONS.dueSoon, LOCATIONS.overdue],
      INTERVAL_DAYS,
      NOW,
    );

    const byId = new Map(rows.map((row) => [row.location._id, row.status]));
    assert.equal(byId.get("loc-overdue"), STOCKTAKE_STATUS.OVERDUE);
    assert.equal(byId.get("loc-due-soon"), STOCKTAKE_STATUS.DUE_SOON);
    assert.equal(byId.get("loc-ok"), STOCKTAKE_STATUS.OK);
  });

  it("orders by urgency: most overdue first, then soonest due", function () {
    const rows = buildStocktakeRows(
      [LOCATIONS.ok, LOCATIONS.lessOverdue, LOCATIONS.dueSoon, LOCATIONS.overdue],
      INTERVAL_DAYS,
      NOW,
    );

    assert.deepEqual(
      rows.map((row) => row.location._id),
      ["loc-overdue", "loc-older", "loc-due-soon", "loc-ok"],
    );
  });

  it("summarises the counts the panel header reports", function () {
    const rows = buildStocktakeRows(
      [LOCATIONS.ok, LOCATIONS.lessOverdue, LOCATIONS.dueSoon, LOCATIONS.overdue],
      INTERVAL_DAYS,
      NOW,
    );

    assert.deepEqual(summariseStocktakeRows(rows), {
      overdue: 2,
      dueSoon: 1,
      ok: 1,
      total: 4,
    });
  });
});

describe("UnitStocktakePanelView", function () {
  it("lists locations with their due state and links to each location", function () {
    const html = renderPanel({
      rows: buildStocktakeRows([LOCATIONS.overdue, LOCATIONS.dueSoon], INTERVAL_DAYS, NOW),
      canStocktake: true,
    });

    assert.ok(html.includes("Rack A"));
    assert.ok(html.includes("Shelf A1"));
    assert.ok(html.includes("30 days overdue"));
    assert.ok(html.includes("Shelf B1"));
    assert.ok(html.includes("Due in 5 days"));
    assert.ok(html.includes('href="/locations/loc-overdue"'));
    assert.ok(html.includes('href="/locations/loc-due-soon"'));
  });

  it("offers a stocktake link per location when the viewer may count", function () {
    const html = renderPanel({
      rows: buildStocktakeRows([LOCATIONS.overdue], INTERVAL_DAYS, NOW),
      canStocktake: true,
    });

    assert.ok(html.includes('href="/stocktake/loc-overdue"'));
    assert.ok(html.includes("Stocktake"));
  });

  it("hides the stocktake link from viewers without the permission", function () {
    const html = renderPanel({
      rows: buildStocktakeRows([LOCATIONS.overdue], INTERVAL_DAYS, NOW),
      canStocktake: false,
    });

    assert.ok(!html.includes('href="/stocktake/loc-overdue"'));
    // The location itself stays reachable.
    assert.ok(html.includes('href="/locations/loc-overdue"'));
  });

  it("headlines the worst status present", function () {
    const overdueHtml = renderPanel({
      rows: buildStocktakeRows([LOCATIONS.overdue, LOCATIONS.dueSoon], INTERVAL_DAYS, NOW),
    });
    assert.ok(overdueHtml.includes("Stocktake overdue"));
    assert.ok(overdueHtml.includes("1 overdue · 1 due soon"));

    const dueSoonHtml = renderPanel({
      rows: buildStocktakeRows([LOCATIONS.dueSoon, LOCATIONS.ok], INTERVAL_DAYS, NOW),
    });
    assert.ok(dueSoonHtml.includes("Stocktake due soon"));

    const okHtml = renderPanel({
      rows: buildStocktakeRows([LOCATIONS.ok], INTERVAL_DAYS, NOW),
    });
    assert.ok(okHtml.includes("All counted"));
    assert.ok(okHtml.includes("1 location current"));
  });

  it("renders an empty state for a unit with no locations", function () {
    const html = renderPanel({ rows: [] });
    assert.ok(html.includes("No storage locations in this unit."));
  });
});
