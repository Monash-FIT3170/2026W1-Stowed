import assert from "assert";
import React from "react";

import { GridLayer } from "../imports/ui/pages/floorMapComponents/canvas/components/layers/GridLayer";
import { snapToGrid } from "../imports/ui/pages/floorMapComponents/canvas/editor/utils/Snapping";
import { CANVAS_CONFIG } from "../imports/ui/pages/floorMapComponents/canvas/CanvasConfig";
import { COLOURS } from "../imports/ui/pages/floorMapComponents/FloorMapStyles";

function getDropPlacement({
  template,
  clientX,
  clientY,
  stage,
  snapEnabled,
  gridSizePx,
  width,
  height,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  const stageBox = stage.container().getBoundingClientRect();
  const pointer = { x: clientX - stageBox.left, y: clientY - stageBox.top };

  const x = (pointer.x - stage.x()) / stage.scaleX();
  const y = (pointer.y - stage.y()) / stage.scaleY();

  const wPixels = template.width * px;
  const hPixels = template.height * px;
  const snappedX = snapEnabled ? snapToGrid(x - wPixels / 2, gridSizePx) : x - wPixels / 2;
  const snappedY = snapEnabled ? snapToGrid(y - hPixels / 2, gridSizePx) : y - hPixels / 2;

  if (x < 0 || y < 0 || x > width || y > height) return null;

  const clampedX = Math.max(0, Math.min(snappedX, width - wPixels));
  const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));

  return {
    pixelUnit: {
      ...template,
      x: clampedX,
      y: clampedY,
      width: wPixels,
      height: hPixels,
    },
    unit: {
      ...template,
      x: clampedX / px,
      y: clampedY / px,
      width: template.width,
      height: template.height,
    },
  };
}

describe("Grid Snapping - Canvas alignment and snapping to grid", function () {
  it("snaps values to the nearest grid line", function () {
    assert.strictEqual(snapToGrid(0, 50), 0);
    assert.strictEqual(snapToGrid(24, 50), 0);
    assert.strictEqual(snapToGrid(25, 50), 50);
    assert.strictEqual(snapToGrid(74, 50), 50);
    assert.strictEqual(snapToGrid(75, 50), 100);
    assert.strictEqual(snapToGrid(125, 50), 150);
  });

  it("supports smaller grid intervals for half-metre snapping", function () {
    const halfMeterGrid = CANVAS_CONFIG.PIXELS_PER_METER / 2;

    assert.strictEqual(halfMeterGrid, 25);
    assert.strictEqual(snapToGrid(12, halfMeterGrid), 0);
    assert.strictEqual(snapToGrid(13, halfMeterGrid), 25);
    assert.strictEqual(snapToGrid(37, halfMeterGrid), 25);
    assert.strictEqual(snapToGrid(38, halfMeterGrid), 50);
  });

  it("renders only the canvas background when grid display is disabled", function () {
    const layer = GridLayer({
      width: 200,
      height: 150,
      gridSizePx: 50,
      showGrid: false,
    });

    const children = React.Children.toArray(layer.props.children);
    const [background] = children;

    assert.strictEqual(children.length, 1);
    assert.strictEqual(background.props.x, 0);
    assert.strictEqual(background.props.y, 0);
    assert.strictEqual(background.props.width, 200);
    assert.strictEqual(background.props.height, 150);
    assert.strictEqual(background.props.fill, COLOURS.CANVAS_FILL);
  });

  it("aligns grid lines and metre labels to the configured grid interval", function () {
    const layer = GridLayer({
      width: 200,
      height: 100,
      gridSizePx: 50,
      showGrid: true,
    });

    const children = React.Children.toArray(layer.props.children);
    const [, ...gridChildren] = children;
    const lines = gridChildren.filter((child) => child.props.points);
    const labels = gridChildren.filter((child) => child.props.text);

    assert.deepStrictEqual(
      lines.map((line) => line.props.points),
      [
        [50, 0, 50, 100],
        [100, 0, 100, 100],
        [150, 0, 150, 100],
        [200, 0, 200, 100],
        [0, 50, 200, 50],
        [0, 100, 200, 100],
      ],
    );
    assert.deepStrictEqual(
      labels.map((label) => label.props.text),
      ["1m", "2m", "3m", "4m", "1m", "2m"],
    );
    assert.ok(lines.every((line) => line.props.stroke === COLOURS.CANVAS_GRID));
    assert.ok(labels.every((label) => label.props.fill === COLOURS.CANVAS_LABEL));
  });

  it("does not draw grid lines or labels at the origin", function () {
    const layer = GridLayer({
      width: 100,
      height: 100,
      gridSizePx: 50,
      showGrid: true,
    });

    const children = React.Children.toArray(layer.props.children);
    const lines = children.filter((child) => child.props.points);
    const labels = children.filter((child) => child.props.text);

    assert.ok(lines.every((line) => line.props.points[0] !== 0 || line.props.points[1] !== 0));
    assert.ok(labels.every((label) => label.props.text !== "0m"));
  });

  it("renders half-metre labels when grid interval is smaller than one metre", function () {
    const layer = GridLayer({
      width: 100,
      height: 50,
      gridSizePx: 25,
      showGrid: true,
    });

    const children = React.Children.toArray(layer.props.children);
    const labels = children.filter((child) => child.props.text);

    assert.deepStrictEqual(
      labels.map((label) => label.props.text),
      ["0.5m", "1m", "1.5m", "2m", "0.5m", "1m"],
    );
  });

  it("uses the same grid interval for drop snapping and grid alignment", function () {
    const placement = getDropPlacement({
      template: { name: "Aligned Shelf", width: 1, height: 1, fill: "#22c55e" },
      clientX: 138,
      clientY: 87,
      stage: {
        container: () => ({
          getBoundingClientRect: () => ({ left: 0, top: 0 }),
        }),
        x: () => 0,
        y: () => 0,
        scaleX: () => 1,
        scaleY: () => 1,
      },
      snapEnabled: true,
      gridSizePx: 25,
      width: 300,
      height: 200,
    });

    assert.ok(placement);
    assert.strictEqual(placement.pixelUnit.x % 25, 0);
    assert.strictEqual(placement.pixelUnit.y % 25, 0);
    assert.strictEqual(placement.pixelUnit.x, 125);
    assert.strictEqual(placement.pixelUnit.y, 50);
  });
});
