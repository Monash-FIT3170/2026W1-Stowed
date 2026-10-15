import assert from "assert";
import { getStartingPoint } from "../imports/ui/pages/floorMapComponents/canvas/routePoint";

function makeStage({ pointer = { x: 150, y: 100 }, x = 0, y = 0, scaleX = 1, scaleY = 1 } = {}) {
  return {
    getPointerPosition: () => pointer,
    x: () => x,
    y: () => y,
    scaleX: () => scaleX,
    scaleY: () => scaleY,
  };
}

describe("Floor map starting-point selection", function () {
  it("converts the selected floor position from pixels to metres", function () {
    assert.deepStrictEqual(getStartingPoint(makeStage(), 500, 400), { x: 3, y: 2 });
  });

  it("keeps the same floor position after the map is panned", function () {
    const stage = makeStage({ pointer: { x: 70, y: 220 }, x: -80, y: 120 });
    assert.deepStrictEqual(getStartingPoint(stage, 500, 400), { x: 3, y: 2 });
  });

  it("accounts for both pan and independent horizontal and vertical zoom", function () {
    const stage = makeStage({
      pointer: { x: 230, y: 70 },
      x: -70,
      y: 20,
      scaleX: 2,
      scaleY: 0.5,
    });
    assert.deepStrictEqual(getStartingPoint(stage, 500, 400), { x: 3, y: 2 });
  });

  it("preserves fractional metre coordinates without snapping to the editor grid", function () {
    const stage = makeStage({ pointer: { x: 12.5, y: 37.5 } });
    assert.deepStrictEqual(getStartingPoint(stage, 500, 400), { x: 0.25, y: 0.75 });
  });

  it("accepts the floor origin and the far boundary", function () {
    assert.deepStrictEqual(getStartingPoint(makeStage({ pointer: { x: 0, y: 0 } }), 500, 400), {
      x: 0,
      y: 0,
    });
    assert.deepStrictEqual(getStartingPoint(makeStage({ pointer: { x: 500, y: 400 } }), 500, 400), {
      x: 10,
      y: 8,
    });
  });

  it("rejects clicks outside every floor edge", function () {
    const outsidePoints = [
      { x: -1, y: 200 },
      { x: 501, y: 200 },
      { x: 250, y: -1 },
      { x: 250, y: 401 },
    ];
    outsidePoints.forEach((pointer) => {
      assert.strictEqual(getStartingPoint(makeStage({ pointer }), 500, 400), null);
    });
  });

  it("checks floor boundaries after undoing pan and zoom", function () {
    const stage = makeStage({ pointer: { x: 450, y: 250 }, x: 500, y: 50, scaleX: 2, scaleY: 2 });
    assert.strictEqual(getStartingPoint(stage, 500, 400), null);
  });

  it("returns no point until the stage and pointer are available", function () {
    assert.strictEqual(getStartingPoint(null, 500, 400), null);
    assert.strictEqual(getStartingPoint(undefined, 500, 400), null);
    assert.strictEqual(getStartingPoint(makeStage({ pointer: null }), 500, 400), null);
  });

  it("rejects non-finite transformed coordinates", function () {
    assert.strictEqual(getStartingPoint(makeStage({ scaleX: 0 }), 500, 400), null);
    assert.strictEqual(
      getStartingPoint(makeStage({ pointer: { x: Number.NaN, y: 100 } }), 500, 400),
      null,
    );
  });
});
