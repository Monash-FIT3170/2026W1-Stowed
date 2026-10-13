import assert from "assert";

import {
  closestPointOnSegment,
  clipSegmentToBounds,
  findNearestUnitEdgePoint,
} from "../imports/ui/pages/floorMapComponents/canvas/editor/utils/UnitEdges";

// A 2m x 1m rectangular unit with its top-left corner at (1, 1)
const RECT_UNIT = { _id: "rect", x: 1, y: 1, width: 2, height: 1, type: "shelf" };

// A triangular custom-shape unit placed at (10, 10)
const TRIANGLE_UNIT = {
  _id: "triangle",
  x: 10,
  y: 10,
  width: 2,
  height: 2,
  type: "custom",
  shape: {
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ],
  },
};

describe("Unit edge snapping", function () {
  describe("closestPointOnSegment", function () {
    it("projects a point onto the middle of a segment", function () {
      assert.deepStrictEqual(
        closestPointOnSegment({ x: 1, y: 5 }, { x: 0, y: 0 }, { x: 2, y: 0 }),
        {
          x: 1,
          y: 0,
        },
      );
    });

    it("clamps to the segment's end points", function () {
      assert.deepStrictEqual(
        closestPointOnSegment({ x: 9, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }),
        {
          x: 2,
          y: 0,
        },
      );
    });

    it("handles a zero-length segment", function () {
      assert.deepStrictEqual(
        closestPointOnSegment({ x: 5, y: 5 }, { x: 1, y: 1 }, { x: 1, y: 1 }),
        {
          x: 1,
          y: 1,
        },
      );
    });
  });

  describe("findNearestUnitEdgePoint", function () {
    it("snaps to the nearest side of a rectangular unit", function () {
      const result = findNearestUnitEdgePoint({ x: 2, y: 0.8 }, [RECT_UNIT], 0.5);
      assert.strictEqual(result.unit._id, "rect");
      assert.deepStrictEqual({ x: result.x, y: result.y }, { x: 2, y: 1 });
    });

    it("snaps from inside a unit to its nearest side", function () {
      const result = findNearestUnitEdgePoint({ x: 2.9, y: 1.5 }, [RECT_UNIT], 0.5);
      assert.ok(Math.abs(result.x - 3) < 1e-9 && Math.abs(result.y - 1.5) < 1e-9);
    });

    it("snaps to the sloped side of a custom shape", function () {
      // Hypotenuse runs from (12, 10) to (10, 12); its midpoint is (11, 11)
      const result = findNearestUnitEdgePoint({ x: 11.2, y: 11.2 }, [TRIANGLE_UNIT], 0.5);
      assert.strictEqual(result.unit._id, "triangle");
      assert.ok(Math.abs(result.x - 11) < 1e-9 && Math.abs(result.y - 11) < 1e-9);
    });

    it("picks the closer of two units", function () {
      const result = findNearestUnitEdgePoint({ x: 9.9, y: 10.5 }, [RECT_UNIT, TRIANGLE_UNIT], 5);
      assert.strictEqual(result.unit._id, "triangle");
    });

    it("returns null when no side is within range", function () {
      assert.strictEqual(findNearestUnitEdgePoint({ x: 6, y: 6 }, [RECT_UNIT], 0.5), null);
    });
  });
});

describe("Floor boundary clipping", function () {
  const FLOOR = { minX: 0.1, minY: 0.1, maxX: 9.9, maxY: 9.9 }; // 10m floor, 0.1m margin

  describe("clipSegmentToBounds", function () {
    it("keeps a segment that is fully inside", function () {
      assert.deepStrictEqual(clipSegmentToBounds({ x: 1, y: 1 }, { x: 3, y: 1 }, FLOOR), [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
      ]);
    });

    it("trims a segment that crosses the boundary", function () {
      const [start, end] = clipSegmentToBounds({ x: 0, y: 2 }, { x: 4, y: 2 }, FLOOR);
      assert.ok(Math.abs(start.x - 0.1) < 1e-9 && start.y === 2);
      assert.deepStrictEqual(end, { x: 4, y: 2 });
    });

    it("drops a segment lying along the floor boundary", function () {
      assert.strictEqual(clipSegmentToBounds({ x: 0, y: 2 }, { x: 0, y: 5 }, FLOOR), null);
      assert.strictEqual(clipSegmentToBounds({ x: 2, y: 10 }, { x: 6, y: 10 }, FLOOR), null);
    });
  });

  describe("findNearestUnitEdgePoint with bounds", function () {
    // A unit pushed against the left wall: its left side runs along x = 0
    const WALL_UNIT = { _id: "wall", x: 0, y: 2, width: 2, height: 2, type: "shelf" };

    it("never snaps onto a side that runs along the floor boundary", function () {
      // Nearest side without bounds would be the wall side at x = 0
      const result = findNearestUnitEdgePoint({ x: 0.05, y: 3 }, [WALL_UNIT], 0.5, FLOOR);
      assert.strictEqual(result, null);
    });

    it("still snaps to the unit's other sides, away from the wall", function () {
      const result = findNearestUnitEdgePoint({ x: 1, y: 1.8 }, [WALL_UNIT], 0.5, FLOOR);
      assert.deepStrictEqual({ x: result.x, y: result.y }, { x: 1, y: 2 });
    });

    it("keeps a side touching the wall clear of the boundary", function () {
      // Pointer near the top-left corner: the top side is clipped to start at x = 0.1
      const result = findNearestUnitEdgePoint({ x: 0, y: 1.9 }, [WALL_UNIT], 0.5, FLOOR);
      assert.ok(Math.abs(result.x - 0.1) < 1e-9 && result.y === 2);
    });
  });
});
