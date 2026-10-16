import assert from "assert";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import {
  buildPlacements,
  buildUnitMaps,
  groupUnitByShelf,
  rankSearchRows,
} from "../imports/ui/pages/floorMapComponents/customerMapData";
import { CustomerUnitPanel } from "../imports/ui/pages/floorMapComponents/CustomerUnitPanel";
import { SearchResultRow } from "../imports/ui/pages/floorMapComponents/CustomerMapSearch";
import { ShoppingListControl } from "../imports/ui/components/ShoppingListControl";
import { addToShoppingList, clearShoppingList } from "../imports/ui/customerShoppingList";
import {
  canvasReducer,
  initialCanvasState,
} from "../imports/ui/pages/floorMapComponents/canvas/editor/EditorReducer";
import { CANVAS_ACTIONS } from "../imports/ui/pages/floorMapComponents/canvas/editor/Actions";

const sites = [
  { _id: "site-main", name: "Main store" },
  { _id: "site-annex", name: "Annex" },
];
const maps = [
  { _id: "map-ground", siteId: "site-main", name: "Ground" },
  { _id: "map-upper", siteId: "site-main", name: "Upper" },
  { _id: "map-annex", siteId: "site-annex", name: "Annex floor" },
];
const units = [
  { _id: "unit-a", floorMapId: "map-ground", name: "Cabinet A" },
  { _id: "unit-b", floorMapId: "map-upper", name: "Cabinet B" },
  { _id: "unit-c", floorMapId: "map-annex", name: "Cabinet C" },
  // On a private map, so never published to the customer view.
  { _id: "unit-private", floorMapId: "map-private", name: "Back room" },
];

const product = (id, name, locations = [], stockStatus = "in-stock") => ({
  _id: id,
  name,
  stockStatus,
  locations,
});
const at = (unitId, unitName, shelf) => ({
  unitId,
  unitName,
  label: shelf ? `${unitName} · ${shelf}` : unitName,
});

describe("Customer floor map", function () {
  describe("customer map data", function () {
    it("groups a unit's products by shelf, both sorted by name", function () {
      const placements = buildPlacements([
        product("p-zinc", "Zinc", [at("unit-a", "Cabinet A", "Shelf 2")]),
        product("p-apple", "Apple", [at("unit-a", "Cabinet A", "Shelf 2")]),
        product("p-bean", "Bean", [at("unit-a", "Cabinet A", "Shelf 1")]),
        product("p-other", "Other", [at("unit-b", "Cabinet B", "Shelf 1")]),
      ]);

      const shelves = groupUnitByShelf(placements, "unit-a");
      assert.deepStrictEqual(
        shelves.map((shelf) => [shelf.shelfName, shelf.products.map((p) => p.name)]),
        [
          ["Shelf 1", ["Bean"]],
          ["Shelf 2", ["Apple", "Zinc"]],
        ],
      );
    });

    it("maps only public units, naming the site only when it has several maps", function () {
      const unitMaps = buildUnitMaps(units, maps, sites);

      assert.deepStrictEqual(unitMaps.get("unit-a"), {
        floorMapId: "map-ground",
        mapLabel: "Main store · Ground",
      });
      assert.deepStrictEqual(unitMaps.get("unit-c"), {
        floorMapId: "map-annex",
        mapLabel: "Annex floor",
      });
      assert.strictEqual(unitMaps.has("unit-private"), false);
    });

    it("ranks search rows: this map, then other public maps, then unplaced", function () {
      const unitMaps = buildUnitMaps(units, maps, sites);
      const row = (name, unitId, label = "Somewhere") => ({
        product: { name },
        unitId,
        label,
      });

      const ranked = rankSearchRows(
        [
          row("Apple", "unit-private"),
          row("Apple", "unit-b"),
          row("Zinc", "unit-a"),
          row("Apple", null, ""),
          row("Apple", "unit-a"),
        ],
        "map-ground",
        unitMaps,
      );

      assert.deepStrictEqual(
        ranked.map((r) => `${r.product.name}@${r.unitId}`),
        ["Apple@unit-a", "Zinc@unit-a", "Apple@unit-b", "Apple@null", "Apple@unit-private"],
      );
    });
  });

  describe("CustomerUnitPanel", function () {
    const placements = buildPlacements([
      product("p-gloves", "Gloves", [at("unit-a", "Cabinet A", "Shelf 1")]),
      product("p-kit", "First aid kit", [at("unit-a", "Cabinet A", "Shelf 2")], "low-stock"),
    ]);
    const render = (props = {}) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <CustomerUnitPanel
            unitId="unit-a"
            unitName="Cabinet A"
            placements={placements}
            loading={false}
            onClose={() => {}}
            {...props}
          />
        </MemoryRouter>,
      );

    it("opens every shelf by default and lists all of its products", function () {
      const markup = render();

      assert.strictEqual(markup.match(/aria-expanded="true"/g)?.length, 2);
      assert.ok(!markup.includes('aria-expanded="false"'));
      assert.ok(markup.includes("Gloves"));
      assert.ok(markup.includes("First aid kit"));
      assert.ok(markup.includes("2 products"));
    });

    it("marks the shelf a search led to, without closing the others", function () {
      const markup = render({ focusShelfName: "Shelf 2", focusNonce: 1 });

      assert.strictEqual(markup.match(/cfm-shelf--focus/g)?.length, 1);
      assert.strictEqual(markup.match(/aria-expanded="true"/g)?.length, 2);
    });

    it("offers adding each product to the shopping list", function () {
      const markup = render();
      assert.strictEqual(markup.match(/>Add to list</g)?.length, 2);
      assert.ok(markup.includes('aria-label="Add Gloves to shopping list"'));
    });
  });

  describe("SearchResultRow", function () {
    const row = {
      key: "p-gloves|Cabinet A · Shelf 1",
      product: product("p-gloves", "Gloves"),
      unitId: "unit-a",
      label: "Cabinet A · Shelf 1",
    };
    const render = (props) =>
      renderToStaticMarkup(
        <ul>
          <SearchResultRow id="opt-0" row={row} currentMapId="map-ground" {...props} />
        </ul>,
      );

    it("shows a result on the current map", function () {
      const markup = render({ map: { floorMapId: "map-ground", mapLabel: "Main store · Ground" } });
      assert.ok(markup.includes("Show on map"));
      assert.ok(markup.includes('aria-disabled="false"'));
      assert.ok(!markup.includes("Main store · Ground"));
    });

    it("names the other map and keeps the pill short", function () {
      const markup = render({ map: { floorMapId: "map-upper", mapLabel: "Main store · Upper" } });
      assert.ok(markup.includes("Go to map"));
      assert.ok(markup.includes("Cabinet A · Shelf 1 · Main store · Upper"));
    });

    it("disables a result that is not on any public map", function () {
      const markup = render({ map: undefined });
      assert.ok(markup.includes('aria-disabled="true"'));
      assert.ok(markup.includes("ask staff for directions"));
      assert.ok(!markup.includes("Show on map"));
      assert.ok(!markup.includes("Go to map"));
    });
  });

  describe("ShoppingListControl compact variant", function () {
    const render = () =>
      renderToStaticMarkup(
        <ShoppingListControl productId="p-gloves" productName="Gloves" variant="compact" />,
      );

    it("is a single add button while the item is not on the list", function () {
      if (Meteor.isClient) clearShoppingList();
      const markup = render();

      assert.ok(markup.includes(">Add to list<"));
      assert.ok(!markup.includes("slc-stepper"));
      assert.strictEqual(markup.match(/<button/g)?.length, 1);
    });

    if (Meteor.isClient) {
      it("becomes a quantity stepper once the item is on the list", function () {
        clearShoppingList();
        addToShoppingList("p-gloves", 3);
        try {
          const markup = render();
          assert.ok(markup.includes("slc-stepper"));
          assert.ok(markup.includes(">3<"));
          assert.ok(!markup.includes("Add to list"));
          // Minus at one would take it off, so at 3 it is a plain decrease.
          assert.ok(markup.includes('aria-label="Decrease quantity for Gloves"'));
        } finally {
          clearShoppingList();
        }
      });
    }
  });

  describe("canvas CENTRE_ON", function () {
    it("pans so the point sits mid-viewport at the current scale", function () {
      const state = {
        ...initialCanvasState,
        scale: 2,
        displaySize: { width: 800, height: 600 },
      };
      const next = canvasReducer(state, {
        type: CANVAS_ACTIONS.CENTRE_ON,
        payload: { x: 100, y: 50 },
      });

      assert.deepStrictEqual(next.stagePos, { x: 800 / 2 - 100 * 2, y: 600 / 2 - 50 * 2 });
      assert.strictEqual(next.pendingCentre, null);
    });

    it("holds a centre that arrives before the viewport is measured", function () {
      const point = { x: 100, y: 50 };
      const pending = canvasReducer(initialCanvasState, {
        type: CANVAS_ACTIONS.CENTRE_ON,
        payload: point,
      });
      assert.deepStrictEqual(pending.pendingCentre, point);

      const measured = canvasReducer(pending, {
        type: CANVAS_ACTIONS.RESIZE_VIEWPORT,
        payload: {
          displaySize: { width: 800, height: 600 },
          floorSize: { width: 400, height: 300 },
          reset: true,
        },
      });

      // Applied with whatever scale the refit settled on, not the old one.
      assert.strictEqual(measured.pendingCentre, null);
      assert.deepStrictEqual(measured.stagePos, {
        x: 400 - point.x * measured.scale,
        y: 300 - point.y * measured.scale,
      });
    });
  });
});
