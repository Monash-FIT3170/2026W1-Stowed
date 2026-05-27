import assert from "assert";
import React from "react";

import { StorageUnit } from "../imports/ui/pages/floorMapComponents/canvas/components/units/StorageUnit";
import { UnitLayer } from "../imports/ui/pages/floorMapComponents/canvas/components/layers/UnitLayer";
import { GhostLayer } from "../imports/ui/pages/floorMapComponents/canvas/components/layers/GhostLayer";
import { canvasReducer, initialCanvasState } from "../imports/ui/pages/floorMapComponents/canvas/editor/EditorReducer";
import { CANVAS_ACTIONS } from "../imports/ui/pages/floorMapComponents/canvas/editor/Actions";
import { CANVAS_CONFIG } from "../imports/ui/pages/floorMapComponents/canvas/CanvasConfig";
import { COLOURS } from "../imports/ui/pages/floorMapComponents/FloorMapStyles";

function snapToGrid(value, snapInterval) {
  return Math.round(value / snapInterval) * snapInterval;
}

function hasPixelCollision(bounds, units) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  return units.some((unit) => {
    const other = {
      dom: { lower: unit.x * px, upper: (unit.x + unit.width) * px },
      ran: { lower: unit.y * px, upper: (unit.y + unit.height) * px },
    };

    return bounds.dom.lower < other.dom.upper &&
      bounds.dom.upper > other.dom.lower &&
      bounds.ran.lower < other.ran.upper &&
      bounds.ran.upper > other.ran.lower;
  });
}

function getDropPlacement({
  template,
  clientX,
  clientY,
  stage,
  snapEnabled,
  gridSizePx,
  width,
  height,
  units,
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
  const bounds = {
    dom: { lower: clampedX, upper: clampedX + wPixels },
    ran: { lower: clampedY, upper: clampedY + hPixels },
  };

  if (hasPixelCollision(bounds, units)) return null;

  return {
    pixelUnit: { ...template, x: clampedX, y: clampedY, width: wPixels, height: hPixels },
    unit: {
      ...template,
      x: clampedX / px,
      y: clampedY / px,
      width: template.width,
      height: template.height,
    },
  };
}

describe("Floor map canvas", function () {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  const unit = {
    id: "unit-a",
    name: "Shelf A",
    type: "shelf",
    x: 2,
    y: 3,
    width: 4,
    height: 2,
    fill: "#3b82f6",
  };

  describe("unit rendering", function () {
    it("renders a storage unit at metre-scaled canvas coordinates", function () {
      const element = StorageUnit({
        unit,
        isSelected: true,
        activeTool: "move",
        onSelect: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        onTransformEnd: () => {},
        groupRef: () => {},
      });

      const [rect, text] = React.Children.toArray(element.props.children);

      assert.strictEqual(element.props.id, "unit-a");
      assert.strictEqual(element.props.x, unit.x * px);
      assert.strictEqual(element.props.y, unit.y * px);
      assert.strictEqual(element.props.draggable, true);

      assert.strictEqual(rect.props.width, unit.width * px);
      assert.strictEqual(rect.props.height, unit.height * px);
      assert.strictEqual(rect.props.fill, unit.fill);
      assert.strictEqual(rect.props.stroke, COLOURS.ACCENT);

      assert.strictEqual(text.props.text, unit.name);
      assert.strictEqual(text.props.width, unit.width * px);
      assert.strictEqual(text.props.height, unit.height * px);
    });

    it("only makes storage units draggable while the move tool is active", function () {
      const selectModeUnit = StorageUnit({
        unit,
        isSelected: false,
        activeTool: "select",
        onSelect: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        onTransformEnd: () => {},
        groupRef: () => {},
      });

      const moveModeUnit = StorageUnit({
        unit,
        isSelected: false,
        activeTool: "move",
        onSelect: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        onTransformEnd: () => {},
        groupRef: () => {},
      });

      assert.strictEqual(selectModeUnit.props.draggable, false);
      assert.strictEqual(moveModeUnit.props.draggable, true);
    });

    it("uses a transparent stroke for unselected storage units", function () {
      const element = StorageUnit({
        unit,
        isSelected: false,
        activeTool: "move",
        onSelect: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        onTransformEnd: () => {},
        groupRef: () => {},
      });

      const [rect] = React.Children.toArray(element.props.children);

      assert.strictEqual(rect.props.stroke, "transparent");
      assert.strictEqual(rect.props.strokeWidth, 2);
      assert.strictEqual(rect.props.opacity, 0.85);
    });

    it("renders unit layer children with selected state and unit-specific callbacks", function () {
      const units = [
        unit,
        { ...unit, id: "unit-b", name: "Shelf B", x: 7 },
      ];
      const refs = {};
      const clicked = [];
      const dragged = [];

      const layer = UnitLayer({
        units,
        selectedIds: new Set(["unit-b"]),
        activeTool: "move",
        getGroupRef: (id) => {
          if (!refs[id]) refs[id] = { current: null };
          return refs[id];
        },
        onUnitClick: (clickedUnit) => clicked.push(clickedUnit.id),
        onDragMove: (_event, id) => dragged.push(`move:${id}`),
        onDragEnd: (_event, id) => dragged.push(`end:${id}`),
        onTransformEnd: () => {},
      });

      const children = React.Children.toArray(layer.props.children);

      assert.strictEqual(children.length, 2);
      assert.strictEqual(children[0].props.unit.id, "unit-a");
      assert.strictEqual(children[0].props.isSelected, false);
      assert.strictEqual(children[1].props.unit.id, "unit-b");
      assert.strictEqual(children[1].props.isSelected, true);

      children[1].props.onSelect({ evt: { shiftKey: false } });
      children[1].props.onDragMove({});
      children[1].props.onDragEnd({});

      assert.deepStrictEqual(clicked, ["unit-b"]);
      assert.deepStrictEqual(dragged, ["move:unit-b", "end:unit-b"]);
    });

    it("renders an empty unit layer when there are no units", function () {
      const layer = UnitLayer({
        units: [],
        selectedIds: new Set(),
        activeTool: "move",
        getGroupRef: () => ({ current: null }),
        onUnitClick: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        onTransformEnd: () => {},
      });

      assert.strictEqual(React.Children.toArray(layer.props.children).length, 0);
    });
  });

  describe("drag-and-drop preview", function () {
    it("renders the single-unit drop ghost using pixel dimensions from drag state", function () {
      const ghostUnit = {
        id: "ghost",
        name: "New Shelf",
        x: 100,
        y: 150,
        width: 125,
        height: 75,
        fill: "#16a34a",
      };

      const layer = GhostLayer({
        ghostUnit,
        dragOffsets: { deltaX: 0, deltaY: 0, unitId: null },
        selectedIds: new Set(),
        units: [],
        snapEnabled: true,
        gridSizePx: 50,
      });

      const [ghostGroup] = React.Children.toArray(layer.props.children);
      const [rect, text] = React.Children.toArray(ghostGroup.props.children);

      assert.strictEqual(ghostGroup.props.x, ghostUnit.x);
      assert.strictEqual(ghostGroup.props.y, ghostUnit.y);
      assert.strictEqual(rect.props.width, ghostUnit.width);
      assert.strictEqual(rect.props.height, ghostUnit.height);
      assert.deepStrictEqual(rect.props.dash, [6, 4]);
      assert.strictEqual(text.props.text, ghostUnit.name);
    });

    it("renders snapped ghost positions for selected units during multi-unit drag", function () {
      const layer = GhostLayer({
        ghostUnit: null,
        dragOffsets: { deltaX: 0.7, deltaY: 0.4, unitId: "unit-a" },
        selectedIds: new Set(["unit-a", "unit-b"]),
        units: [
          unit,
          { ...unit, id: "unit-b", name: "Shelf B", x: 6, y: 1 },
        ],
        snapEnabled: true,
        gridSizePx: 50,
      });

      const [firstGhost, secondGhost] = React.Children.toArray(layer.props.children);

      assert.strictEqual(firstGhost.props.x, 150);
      assert.strictEqual(firstGhost.props.y, 150);
      assert.strictEqual(secondGhost.props.x, 350);
      assert.strictEqual(secondGhost.props.y, 50);
    });

    it("renders unsnapped multi-unit drag ghosts when snap is disabled", function () {
      const layer = GhostLayer({
        ghostUnit: null,
        dragOffsets: { deltaX: 0.25, deltaY: -0.5, unitId: "unit-a" },
        selectedIds: new Set(["unit-a"]),
        units: [unit],
        snapEnabled: false,
        gridSizePx: 50,
      });

      const [ghost] = React.Children.toArray(layer.props.children);

      assert.strictEqual(ghost.props.x, 112.5);
      assert.strictEqual(ghost.props.y, 125);
    });

    it("skips selected ids that no longer exist in the unit list", function () {
      const layer = GhostLayer({
        ghostUnit: null,
        dragOffsets: { deltaX: 1, deltaY: 1, unitId: "missing-unit" },
        selectedIds: new Set(["missing-unit"]),
        units: [unit],
        snapEnabled: true,
        gridSizePx: 50,
      });

      assert.strictEqual(React.Children.toArray(layer.props.children).length, 0);
    });

    it("renders no ghost children when nothing is being dropped or dragged", function () {
      const layer = GhostLayer({
        ghostUnit: null,
        dragOffsets: { deltaX: 0, deltaY: 0, unitId: null },
        selectedIds: new Set(["unit-a"]),
        units: [unit],
        snapEnabled: true,
        gridSizePx: 50,
      });

      assert.strictEqual(React.Children.toArray(layer.props.children).length, 0);
    });
  });

  describe("drag-and-drop placement", function () {
    function createStage({ left = 10, top = 20, x = 25, y = 50, scale = 2 } = {}) {
      return {
        container: () => ({
          getBoundingClientRect: () => ({ left, top }),
        }),
        x: () => x,
        y: () => y,
        scaleX: () => scale,
        scaleY: () => scale,
      };
    }

    it("converts drop coordinates into snapped metre-based unit placement", function () {
      const placement = getDropPlacement({
        template: { name: "Drop Shelf", type: "shelf", width: 2, height: 1, fill: "#22c55e" },
        clientX: 335,
        clientY: 220,
        stage: createStage(),
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [],
      });

      assert.ok(placement);
      assert.strictEqual(placement.pixelUnit.x, 100);
      assert.strictEqual(placement.pixelUnit.y, 50);
      assert.strictEqual(placement.pixelUnit.width, 100);
      assert.strictEqual(placement.pixelUnit.height, 50);
      assert.strictEqual(placement.unit.x, 2);
      assert.strictEqual(placement.unit.y, 1);
      assert.strictEqual(placement.unit.width, 2);
      assert.strictEqual(placement.unit.height, 1);
    });

    it("clamps dropped units inside the floor bounds", function () {
      const placement = getDropPlacement({
        template: { name: "Wide Bench", width: 3, height: 2, fill: "#f97316" },
        clientX: 475,
        clientY: 375,
        stage: createStage({ left: 0, top: 0, x: 0, y: 0, scale: 1 }),
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [],
      });

      assert.ok(placement);
      assert.strictEqual(placement.pixelUnit.x, 350);
      assert.strictEqual(placement.pixelUnit.y, 300);
      assert.strictEqual(placement.unit.x, 7);
      assert.strictEqual(placement.unit.y, 6);
    });

    it("keeps fractional pixel placement when snapping is disabled", function () {
      const placement = getDropPlacement({
        template: { name: "Small Shelf", width: 1, height: 1, fill: "#22c55e" },
        clientX: 127,
        clientY: 149,
        stage: createStage({ left: 0, top: 0, x: 0, y: 0, scale: 1 }),
        snapEnabled: false,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [],
      });

      assert.ok(placement);
      assert.strictEqual(placement.pixelUnit.x, 102);
      assert.strictEqual(placement.pixelUnit.y, 124);
      assert.strictEqual(placement.unit.x, 2.04);
      assert.strictEqual(placement.unit.y, 2.48);
    });

    it("accepts pointer positions exactly on the canvas boundary before clamping", function () {
      const placement = getDropPlacement({
        template: { name: "Boundary Shelf", width: 1, height: 1, fill: "#22c55e" },
        clientX: 500,
        clientY: 400,
        stage: createStage({ left: 0, top: 0, x: 0, y: 0, scale: 1 }),
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [],
      });

      assert.ok(placement);
      assert.strictEqual(placement.pixelUnit.x, 450);
      assert.strictEqual(placement.pixelUnit.y, 350);
    });

    it("accounts for stage offset and zoom when converting pointer coordinates", function () {
      const placement = getDropPlacement({
        template: { name: "Zoomed Shelf", width: 2, height: 2, fill: "#22c55e" },
        clientX: 260,
        clientY: 170,
        stage: createStage({ left: 20, top: 10, x: 40, y: 30, scale: 2 }),
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [],
      });

      assert.ok(placement);
      assert.strictEqual(placement.pixelUnit.x, 50);
      assert.strictEqual(placement.pixelUnit.y, 0);
      assert.strictEqual(placement.unit.x, 1);
      assert.strictEqual(placement.unit.y, 0);
    });

    it("allows a drop that exactly touches another unit edge", function () {
      const placement = getDropPlacement({
        template: { name: "Touching Shelf", width: 2, height: 1, fill: "#22c55e" },
        clientX: 200,
        clientY: 75,
        stage: createStage({ left: 0, top: 0, x: 0, y: 0, scale: 1 }),
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [{ ...unit, x: 1, y: 1, width: 2, height: 1 }],
      });

      assert.ok(placement);
      assert.strictEqual(placement.pixelUnit.x, 150);
      assert.strictEqual(placement.pixelUnit.y, 50);
    });

    it("rejects drops outside the canvas or colliding with existing units", function () {
      const template = { name: "Drop Shelf", width: 2, height: 1, fill: "#22c55e" };
      const stage = createStage({ left: 0, top: 0, x: 0, y: 0, scale: 1 });

      const outside = getDropPlacement({
        template,
        clientX: -1,
        clientY: 25,
        stage,
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [],
      });

      const colliding = getDropPlacement({
        template,
        clientX: 150,
        clientY: 75,
        stage,
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [{ ...unit, x: 1, y: 1, width: 2, height: 1 }],
      });

      assert.strictEqual(outside, null);
      assert.strictEqual(colliding, null);
    });

    it("rejects pointer positions just beyond each canvas edge", function () {
      const template = { name: "Drop Shelf", width: 1, height: 1, fill: "#22c55e" };
      const stage = createStage({ left: 0, top: 0, x: 0, y: 0, scale: 1 });
      const base = {
        template,
        stage,
        snapEnabled: true,
        gridSizePx: 50,
        width: 500,
        height: 400,
        units: [],
      };

      assert.strictEqual(getDropPlacement({ ...base, clientX: -1, clientY: 100 }), null);
      assert.strictEqual(getDropPlacement({ ...base, clientX: 501, clientY: 100 }), null);
      assert.strictEqual(getDropPlacement({ ...base, clientX: 100, clientY: -1 }), null);
      assert.strictEqual(getDropPlacement({ ...base, clientX: 100, clientY: 401 }), null);
    });
  });

  describe("selection reducer", function () {
    it("selects, shift-adds, toggles, and clears selected units", function () {
      let state = canvasReducer(initialCanvasState, {
        type: CANVAS_ACTIONS.SELECT_UNIT,
        payload: { id: "unit-a", shiftKey: false },
      });
      assert.deepStrictEqual([...state.selectedIds], ["unit-a"]);

      state = canvasReducer(state, {
        type: CANVAS_ACTIONS.SELECT_UNIT,
        payload: { id: "unit-b", shiftKey: true },
      });
      assert.deepStrictEqual([...state.selectedIds], ["unit-a", "unit-b"]);

      state = canvasReducer(state, {
        type: CANVAS_ACTIONS.SELECT_UNIT,
        payload: { id: "unit-a", shiftKey: true },
      });
      assert.deepStrictEqual([...state.selectedIds], ["unit-b"]);

      state = canvasReducer(state, { type: CANVAS_ACTIONS.DESELECT_ALL });
      assert.strictEqual(state.selectedIds.size, 0);
    });

    it("replaces existing selection when selecting without shift", function () {
      const state = {
        ...initialCanvasState,
        selectedIds: new Set(["unit-a", "unit-b"]),
      };

      const next = canvasReducer(state, {
        type: CANVAS_ACTIONS.SELECT_UNIT,
        payload: { id: "unit-c", shiftKey: false },
      });

      assert.deepStrictEqual([...next.selectedIds], ["unit-c"]);
      assert.deepStrictEqual([...state.selectedIds], ["unit-a", "unit-b"]);
    });

    it("updates transient drag, scale, stage, display, and clipboard state", function () {
      let state = canvasReducer(initialCanvasState, {
        type: CANVAS_ACTIONS.SET_DRAG_OFFSETS,
        payload: { deltaX: 1.5, deltaY: -0.5, unitId: "unit-a" },
      });
      assert.deepStrictEqual(state.dragOffsets, { deltaX: 1.5, deltaY: -0.5, unitId: "unit-a" });

      state = canvasReducer(state, { type: CANVAS_ACTIONS.CLEAR_DRAG_OFFSETS });
      assert.deepStrictEqual(state.dragOffsets, { deltaX: 0, deltaY: 0, unitId: null });

      state = canvasReducer(state, {
        type: CANVAS_ACTIONS.SET_SCALE,
        payload: { scale: 1.75 },
      });
      assert.strictEqual(state.scale, 1.75);

      state = canvasReducer(state, {
        type: CANVAS_ACTIONS.SET_STAGE_POS,
        payload: { x: -20, y: 35 },
      });
      assert.deepStrictEqual(state.stagePos, { x: -20, y: 35 });

      state = canvasReducer(state, {
        type: CANVAS_ACTIONS.SET_DISPLAY_SIZE,
        payload: { width: 640, height: 480 },
      });
      assert.deepStrictEqual(state.displaySize, { width: 640, height: 480 });

      state = canvasReducer(state, {
        type: CANVAS_ACTIONS.COPY_UNITS,
        payload: { units: [unit] },
      });
      assert.deepStrictEqual(state.clipboard, [unit]);
    });

    it("selects pasted units, clears selection on delete, and ignores unknown actions", function () {
      let state = canvasReducer(initialCanvasState, {
        type: CANVAS_ACTIONS.PASTE_UNITS,
        payload: { ids: ["unit-c", "unit-d"] },
      });
      assert.deepStrictEqual([...state.selectedIds], ["unit-c", "unit-d"]);

      state = canvasReducer(state, { type: CANVAS_ACTIONS.DELETE_UNIT });
      assert.strictEqual(state.selectedIds.size, 0);

      const unchanged = canvasReducer(state, { type: "UNKNOWN_ACTION" });
      assert.strictEqual(unchanged, state);
    });
  });
});
