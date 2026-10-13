import assert from "assert";
import { Meteor } from "meteor/meteor";

if (Meteor.isServer) {
  const { planRoute, closestPointOnSegment } = require("../server/routes/planRoute");

  // A straight walkway W1-W2-W3 along y = 0, with product nodes hanging off it:
  //   P1 (loc-a) above W1, P3 (loc-b, loc-c) above W3, and an isolated P4 (loc-d)
  //   whose walkway W4 is not connected to the rest.
  const walkway = (id, x, y) => ({ id, x, y, type: "walkway" });
  const product = (id, x, y, storageLocationIds) => ({
    id,
    x,
    y,
    type: "product",
    storageUnitId: "unit",
    storageLocationIds,
  });
  const route = {
    nodes: [
      walkway("W1", 0, 0),
      walkway("W2", 10, 0),
      walkway("W3", 20, 0),
      product("P1", 0, 2, ["loc-a"]),
      product("P3", 20, 2, ["loc-b", "loc-c"]),
      walkway("W4", 50, 50),
      product("P4", 50, 52, ["loc-d"]),
    ],
    links: [
      { id: "L1", fromId: "W1", toId: "W2" },
      { id: "L2", fromId: "W2", toId: "W3" },
      { id: "L3", fromId: "W1", toId: "P1" },
      { id: "L4", fromId: "W3", toId: "P3" },
      { id: "L5", fromId: "W4", toId: "P4" },
    ],
  };

  describe("closestPointOnSegment", function () {
    it("projects onto the middle of a segment", function () {
      const closest = closestPointOnSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      assert.deepStrictEqual(closest, { x: 5, y: 0, distance: 3 });
    });

    it("clamps to the nearest end of a segment", function () {
      const closest = closestPointOnSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      assert.deepStrictEqual(closest, { x: 0, y: 0, distance: 5 });
    });

    it("handles a zero length segment", function () {
      const closest = closestPointOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
      assert.deepStrictEqual(closest, { x: 0, y: 0, distance: 5 });
    });
  });

  describe("planRoute", function () {
    it("visits the nearest product first, then the next", function () {
      // Start below the W1-W2 walkway: P1 is 7 m away, P3 is 19 m away
      const result = planRoute(
        route,
        { x: 4, y: -1 },
        new Map([
          ["prod-a", ["loc-a"]],
          ["prod-b", ["loc-b"]],
        ]),
      );

      assert.deepStrictEqual(
        result.stops.map((stop) => stop.nodeId),
        ["P1", "P3"],
      );
      assert.deepStrictEqual(result.stops[0].productIds, ["prod-a"]);
      assert.deepStrictEqual(result.stops[1].productIds, ["prod-b"]);
      assert.deepStrictEqual(result.unreachableProductIds, []);
      // start -> (4,0) -> W1 -> P1 -> W1 -> W2 -> W3 -> P3
      assert.deepStrictEqual(result.path[0], { x: 4, y: -1 });
      assert.deepStrictEqual(result.path[1], { x: 4, y: 0 });
      assert.strictEqual(result.distance, 1 + 4 + 2 + 2 + 20 + 2);
    });

    it("picks every product available at the same node in one stop", function () {
      const result = planRoute(
        route,
        { x: 20, y: -1 },
        new Map([
          ["prod-b", ["loc-b"]],
          ["prod-c", ["loc-c"]],
        ]),
      );

      assert.strictEqual(result.stops.length, 1);
      assert.strictEqual(result.stops[0].nodeId, "P3");
      assert.deepStrictEqual(result.stops[0].productIds.sort(), ["prod-b", "prod-c"]);
    });

    it("reports products with no stock location on the map or no connected path", function () {
      const result = planRoute(
        route,
        { x: 0, y: -1 },
        new Map([
          ["prod-a", ["loc-a"]],
          ["prod-missing", []],
          ["prod-isolated", ["loc-d"]],
        ]),
      );

      assert.deepStrictEqual(
        result.stops.map((stop) => stop.nodeId),
        ["P1"],
      );
      assert.deepStrictEqual(result.unreachableProductIds.sort(), ["prod-isolated", "prod-missing"]);
    });

    it("returns an empty route when nothing can be picked", function () {
      const result = planRoute(route, { x: 0, y: 0 }, new Map([["prod-missing", []]]));

      assert.deepStrictEqual(result, {
        path: [],
        stops: [],
        distance: 0,
        unreachableProductIds: ["prod-missing"],
      });
    });

    it("joins the start to the nearest walkway node when there are no walkway links", function () {
      const productOnly = {
        nodes: [walkway("W1", 0, 0), product("P1", 0, 2, ["loc-a"])],
        links: [{ id: "L1", fromId: "W1", toId: "P1" }],
      };
      const result = planRoute(productOnly, { x: 3, y: -4 }, new Map([["prod-a", ["loc-a"]]]));

      assert.deepStrictEqual(
        result.stops.map((stop) => stop.nodeId),
        ["P1"],
      );
      assert.strictEqual(result.distance, 5 + 2);
    });
  });
}
