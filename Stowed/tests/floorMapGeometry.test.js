import assert from "assert";
import {
  buildRectShape,
  transformPoints,
  getTransformedBounds,
} from "../imports/api/locations/shapeUtils";
import {
  getShapeBounds,
  normaliseShapePoints,
} from "../imports/ui/pages/floorMapComponents/canvas/editor/utils/ShapeGeometry";
import {
  getUnitPolygon,
  hasCollisions,
} from "../imports/ui/pages/floorMapComponents/canvas/editor/utils/Collisions";

describe("Shape geometry and placement collisions", function () {
  const rectangle = { id: "shelf", x: 2, y: 3, width: 4, height: 2, type: "shelf" };
  const cornerShelf = {
    id: "corner",
    type: "custom",
    x: 5,
    y: 5,
    width: 4,
    height: 4,
    shape: {
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ],
    },
  };

  it("normalises a shape with negative coordinates without changing the original", function () {
    const points = Object.freeze([
      Object.freeze({ x: -3, y: -2 }),
      Object.freeze({ x: 1, y: -2 }),
      Object.freeze({ x: -3, y: 1 }),
    ]);
    const normalised = normaliseShapePoints(points);
    assert.deepStrictEqual(normalised, [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ]);
    assert.deepStrictEqual(getShapeBounds(normalised), { minX: 0, minY: 0, width: 4, height: 3 });
  });

  it("handles a shape with no points", function () {
    assert.deepStrictEqual(normaliseShapePoints(), []);
    assert.deepStrictEqual(getShapeBounds(), { minX: 0, minY: 0, width: 0, height: 0 });
  });

  it("scales, rotates and translates a saved shape in the correct order", function () {
    const shape = buildRectShape({ width: 2, height: 1 });
    const transform = {
      scale: { x: 2, y: 3 },
      rotation: Math.PI / 2,
      offset: { x: 10, y: 20 },
    };
    const expected = [
      { x: 10, y: 20 },
      { x: 10, y: 24 },
      { x: 7, y: 24 },
      { x: 7, y: 20 },
    ];
    transformPoints(shape, transform).forEach((point, index) => {
      assert.ok(Math.abs(point.x - expected[index].x) < 1e-9);
      assert.ok(Math.abs(point.y - expected[index].y) < 1e-9);
    });
    const bounds = getTransformedBounds(shape, transform);
    for (const [key, value] of Object.entries({
      minX: 7,
      minY: 20,
      maxX: 10,
      maxY: 24,
      width: 3,
      height: 4,
    })) {
      assert.ok(Math.abs(bounds[key] - value) < 1e-9, `${key}: ${bounds[key]}`);
    }
    assert.deepStrictEqual(shape.points, buildRectShape({ width: 2, height: 1 }).points);
  });

  it("places rectangular units in world-space metres", function () {
    assert.deepStrictEqual(getUnitPolygon(rectangle), [
      { x: 2, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 5 },
      { x: 2, y: 5 },
    ]);
  });

  it("uses the custom outline instead of its bounding rectangle", function () {
    const points = getUnitPolygon(cornerShelf);
    assert.strictEqual(points.length, 6);
    assert.deepStrictEqual(points[3], { x: 6, y: 6 });
    assert.deepStrictEqual(cornerShelf.shape.points[3], { x: 1, y: 1 });
  });

  it("falls back to a rectangle for an incomplete custom shape", function () {
    const invalid = { ...rectangle, type: "custom", shape: { points: [{ x: 0, y: 0 }] } };
    assert.deepStrictEqual(getUnitPolygon(invalid), getUnitPolygon(rectangle));
  });

  it("detects overlapping storage units", function () {
    assert.strictEqual(
      hasCollisions({ id: "new", x: 5, y: 4, width: 2, height: 2 }, [rectangle]),
      true,
    );
  });

  it("allows units to touch at an edge or corner", function () {
    for (const position of [
      { x: 6, y: 3 },
      { x: 6, y: 5 },
    ]) {
      assert.strictEqual(
        hasCollisions({ id: "new", ...position, width: 2, height: 2 }, [rectangle]),
        false,
      );
    }
  });

  it("allows a unit inside the empty corner of a concave shelf", function () {
    // Its bounding box overlaps the L-shaped shelf, but its actual outline does not.
    const insideGap = { id: "new", x: 7, y: 7, width: 1, height: 1 };
    assert.strictEqual(hasCollisions(insideGap, [cornerShelf]), false);
    assert.strictEqual(hasCollisions(cornerShelf, [insideGap]), false);
  });

  it("rejects a unit that overlaps an arm of a concave shelf", function () {
    const onArm = { id: "new", x: 5.5, y: 7, width: 1, height: 1 };
    assert.strictEqual(hasCollisions(onArm, [cornerShelf]), true);
    assert.strictEqual(hasCollisions(cornerShelf, [onArm]), true);
  });

  it("ignores the dragged unit itself while still checking other units", function () {
    const moved = { ...rectangle, x: 2.5 };
    assert.strictEqual(hasCollisions(moved, [rectangle], rectangle.id), false);
    const obstacle = { id: "obstacle", x: 6, y: 3, width: 1, height: 1 };
    assert.strictEqual(hasCollisions(moved, [rectangle, obstacle], rectangle.id), true);
  });

  it("allows placement on an empty floor", function () {
    assert.strictEqual(hasCollisions(rectangle, []), false);
  });
});
