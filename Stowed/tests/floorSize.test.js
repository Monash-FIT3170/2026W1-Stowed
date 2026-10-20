import assert from "assert";
import { getFloorSizeInMetres } from "../imports/api/locations/shapeUtils";
import { validateRouteGraph } from "../imports/api/locations/routeGraph";
import { CANVAS_CONFIG } from "../imports/ui/pages/floorMapComponents/canvas/CanvasConfig";

describe("Floor size conversion", function () {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  it("keeps legacy metre dimensions unchanged", function () {
    assert.deepStrictEqual(getFloorSizeInMetres({ width: 10, height: 8 }, px), {
      width: 10,
      height: 8,
    });
  });

  it("converts canvas pixels to metres without changing the stored object", function () {
    const stored = Object.freeze({ width: 500, height: 400 });
    assert.deepStrictEqual(getFloorSizeInMetres(stored, px), { width: 10, height: 8 });
  });

  it("converts both dimensions when only one exceeds the legacy threshold", function () {
    assert.deepStrictEqual(getFloorSizeInMetres({ width: 500, height: 100 }, px), {
      width: 10,
      height: 2,
    });
    assert.deepStrictEqual(getFloorSizeInMetres({ width: 100, height: 500 }, px), {
      width: 2,
      height: 10,
    });
  });

  it("preserves the existing inclusive 100-metre legacy boundary", function () {
    assert.deepStrictEqual(getFloorSizeInMetres({ width: 100, height: 100 }, px), {
      width: 100,
      height: 100,
    });
  });

  it("handles fractional dimensions and the supplied canvas scale", function () {
    assert.deepStrictEqual(getFloorSizeInMetres({ width: 525, height: 412.5 }, px), {
      width: 10.5,
      height: 8.25,
    });
    assert.deepStrictEqual(getFloorSizeInMetres({ width: 600, height: 300 }, 60), {
      width: 10,
      height: 5,
    });
  });

  it("reads numeric values from older serialized dimensions", function () {
    assert.deepStrictEqual(getFloorSizeInMetres({ width: "500", height: "400" }, px), {
      width: 10,
      height: 8,
    });
  });

  for (const [label, size] of [
    ["missing size", undefined],
    ["null size", null],
    ["empty size", {}],
    ["missing height", { width: 500 }],
    ["zero width", { width: 0, height: 400 }],
    ["negative height", { width: 500, height: -1 }],
    ["nonnumeric width", { width: "invalid", height: 400 }],
    ["NaN height", { width: 500, height: NaN }],
  ]) {
    it(`returns null for ${label}`, function () {
      assert.strictEqual(getFloorSizeInMetres(size, px), null);
    });
  }

  it("validates route positions in metres for either stored floor-size format", function () {
    for (const stored of [
      { width: 10, height: 8 },
      { width: 500, height: 400 },
    ]) {
      const floor = getFloorSizeInMetres(stored, px);
      assert.strictEqual(validateRouteGraph([{ id: "inside", x: 9, y: 7 }], [], floor), null);
      assert.match(
        validateRouteGraph([{ id: "outside", x: 11, y: 7 }], [], floor),
        /outside the floor/,
      );
    }
  });
});
