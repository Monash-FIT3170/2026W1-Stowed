import { useEditor } from "../editor/EditorContext";
import { useCallback } from "react";
import { CANVAS_ACTIONS } from "../editor/Actions";
import { snapToGrid } from "../editor/utils/Snapping";
import { hasCollisions } from "../editor/utils/Collisions";
import { dragState } from "../editor/DragState";
import { CANVAS_CONFIG } from "../CanvasConfig";

/**
 * Custom hook that provides all event handlers for the canvas.
 * Handlers are grouped into four concerns: drop, unit interaction, transform, and viewport.
 *
 * @param {Function}    dispatch
 * @param {Object[]}    units
 * @param {Function}    setUnits        - Persists unit changes to EditorContext
 * @param {Set<string>} selectedIds
 * @param {React.Ref}   stageRef
 * @param {React.Ref}   groupRefs       - Mutable map of unit id -> Konva Group ref
 * @param {boolean}     snapEnabled
 * @param {number}      snapSizePx      - Snap interval in pixels
 * @param {number}      snapInterval    - Snap interval in metres
 * @param {number}      width           - Floor width in pixels
 * @param {number}      height          - Floor height in pixel.
 * @param {React.Ref}   wrapperRef
 *
 * @returns {{ getGroupRef, handleDragOver, handleDragLeave, handleDrop,
 *             handleUnitClick, handleStageClick, handleDragMove, handleDragEnd,
 *             handleDragEndGrid, handleTransformEnd, handleWheel, handleZoomIn, handleZoomOut,
 *             handleFitToScreen, handleCopy, handlePaste, handleDuplicate, handleDelete }}
 */
export function useCanvasHandlers({
  dispatch,
  units,
  setUnits,
  selectedIds,
  stageRef,
  groupRefs,
  snapEnabled,
  snapSizePx,
  snapInterval,
  width,
  height,
  wrapperRef,
  clipboard,
  isCanvasEditMode,
}) {
  const { setSelectedUnit, setIsPanelOpen } = useEditor();

  // INTERNAL HELPERS
  function getGroupRef(id) {
    if (!groupRefs.current[id]) groupRefs.current[id] = { current: null };
    return groupRefs.current[id];
  }

  function checkCollisions(proposedUnit, excludeId = null) {
    return hasCollisions(proposedUnit, units, excludeId);
  }

  // Helper: get clamped position (in metres) for any unit at an offset position
  function getMovedPosition(unit, deltaX, deltaY) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const newX = Math.max(0, Math.min(unit.x + deltaX, width / px - unit.width));
    const newY = Math.max(0, Math.min(unit.y + deltaY, height / px - unit.height));
    return { x: newX, y: newY };
  }

  function buildGhostFromEvent(e) {
    const template = dragState.template;
    if (!template) return null;

    const stage = stageRef.current;
    const stageBox = stage.container().getBoundingClientRect();
    const pointer = {
      x: e.clientX - stageBox.left,
      y: e.clientY - stageBox.top,
    };

    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();

    const wPixels = template.width * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPixels = template.height * CANVAS_CONFIG.PIXELS_PER_METER;

    const snappedX = snapEnabled ? snapToGrid(x - wPixels / 2, snapSizePx) : x - wPixels / 2;
    const snappedY = snapEnabled ? snapToGrid(y - hPixels / 2, snapSizePx) : y - hPixels / 2;

    const pointInGrid = x >= 0 && y >= 0 && x <= width && y <= height;
    if (!pointInGrid) return null;

    const clampedX = Math.max(0, Math.min(snappedX, width - wPixels));
    const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));

    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const proposedUnit = {
      type: template.type,
      shape: template.shape,
      x: clampedX / px,
      y: clampedY / px,
      width: template.width,
      height: template.height,
    };

    if (checkCollisions(proposedUnit)) return null;

    return {
      ...template,
      id: "ghost",
      x: clampedX,
      y: clampedY,
      width: wPixels,
      height: hPixels,
    };
  }

  // DROP HANDLERS

  function handleDragOver(e) {
    e.preventDefault();
    const ghost = buildGhostFromEvent(e);
    dispatch({
      type: CANVAS_ACTIONS.SET_GHOST,
      payload: { ghost: ghost ?? null },
    });
  }

  function handleDragLeave(e) {
    if (wrapperRef.current?.contains(e.relatedTarget)) return;
    dispatch({ type: CANVAS_ACTIONS.SET_GHOST, payload: { ghost: null } });
  }

  function handleDrop(e) {
    e.preventDefault();
    dispatch({ type: CANVAS_ACTIONS.SET_GHOST, payload: { ghost: null } });

    const unitData = e.dataTransfer.getData("unit");
    if (!unitData) return;
    const template = JSON.parse(unitData);

    const stage = stageRef.current;
    const stageBox = stage.container().getBoundingClientRect();
    const pointer = {
      x: e.clientX - stageBox.left,
      y: e.clientY - stageBox.top,
    };

    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();

    const wPixels = template.width * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPixels = template.height * CANVAS_CONFIG.PIXELS_PER_METER;

    const snappedX = snapEnabled ? snapToGrid(x - wPixels / 2, snapSizePx) : x - wPixels / 2;
    const snappedY = snapEnabled ? snapToGrid(y - hPixels / 2, snapSizePx) : y - hPixels / 2;

    const pointInGrid = x >= 0 && y >= 0 && x <= width && y <= height;
    if (!pointInGrid) return;

    const clampedX = Math.max(0, Math.min(snappedX, width - wPixels));
    const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));

    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const proposedUnit = {
      type: template.type,
      shape: template.shape,
      x: clampedX / px,
      y: clampedY / px,
      width: template.width,
      height: template.height,
    };
    if (checkCollisions(proposedUnit)) return;

    setUnits((prev) => [
      ...prev,
      {
        ...template,
        id: `unit-${Date.now()}`,
        x: clampedX / px,
        y: clampedY / px,
        width: template.width,
        height: template.height,
      },
    ]);
  }

  // STAGE / UNIT HANDLERS

  function handleUnitClick(unit, e) {
    if (!isCanvasEditMode) {
      setSelectedUnit(unit);
      setIsPanelOpen(true);
      return;
    }

    // Unit clicks should either:
    // select only that unit if multiple units are selected
    // deselect a unit if it is the only unit selected
    // select a unit if nothing is selected
    if (selectedIds.size > 1) {
      dispatch({
        type: CANVAS_ACTIONS.SELECT_UNIT,
        payload: { id: unit.id, shiftKey: e.evt.shiftKey },
      });
      return;
    }
    if (selectedIds.has(unit.id)) {
      dispatch({ type: CANVAS_ACTIONS.DESELECT_ALL });
      return;
    }

    dispatch({
      type: CANVAS_ACTIONS.SELECT_UNIT,
      payload: { id: unit.id, shiftKey: e.evt.shiftKey },
    });
  }

  function handleStageClick(e) {
    if (e.target === e.target.getStage()) {
      dispatch({ type: CANVAS_ACTIONS.DESELECT_ALL });
    }
  }

  function handleDragMove(e, unitId) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const draggedUnit = units.find((u) => u.id === unitId);
    if (!draggedUnit) return;

    const deltaX = e.target.x() / px - draggedUnit.x;
    const deltaY = e.target.y() / px - draggedUnit.y;

    dispatch({
      type: CANVAS_ACTIONS.SET_DRAG_OFFSETS,
      payload: { deltaX, deltaY, unitId },
    });

    if (selectedIds.size <= 1 || !selectedIds.has(unitId)) return;

    // Do not use dispatch for ref.current for performance
    [...selectedIds].forEach((id) => {
      if (id === unitId) return;
      const ref = getGroupRef(id);
      const unit = units.find((u) => u.id === id);
      if (!ref.current || !unit) return;
      ref.current.x((unit.x + deltaX) * px);
      ref.current.y((unit.y + deltaY) * px);
    });
  }

  function handleDragEnd(e, unitId) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const rawXm = e.target.x() / px;
    const rawYm = e.target.y() / px;
    const snappedXm = snapEnabled ? snapToGrid(rawXm, snapInterval) : rawXm;
    const snappedYm = snapEnabled ? snapToGrid(rawYm, snapInterval) : rawYm;

    dispatch({ type: CANVAS_ACTIONS.CLEAR_DRAG_OFFSETS });

    const draggedUnit = units.find((u) => u.id === unitId);
    if (!draggedUnit) return;

    const clampedXm = Math.max(0, Math.min(snappedXm, width / px - draggedUnit.width));
    const clampedYm = Math.max(0, Math.min(snappedYm, height / px - draggedUnit.height));

    const deltaX = clampedXm - draggedUnit.x;
    const deltaY = clampedYm - draggedUnit.y;

    const movedIds = selectedIds.size > 1 && selectedIds.has(unitId) ? [...selectedIds] : [unitId];

    // Check all units that will move for collisions
    const wouldCollide = movedIds.some((id) => {
      const unit = units.find((u) => u.id === id);
      if (!unit) return false;
      const { x, y } = getMovedPosition(unit, deltaX, deltaY);
      return checkCollisions({ ...unit, x, y }, id);
    });

    // Reset all units
    if (wouldCollide) {
      movedIds.forEach((id) => {
        const unit = units.find((u) => u.id === id);
        if (!unit) return;
        const ref = id === unitId ? { current: e.target } : getGroupRef(id);
        if (ref.current) {
          ref.current.x(unit.x * px);
          ref.current.y(unit.y * px);
        }
      });
      return;
    }

    movedIds.forEach((id) => {
      if (id === unitId) return;
      const unit = units.find((u) => u.id === id);
      const ref = getGroupRef(id);
      if (!unit || !ref.current) return;
      const { x, y } = getMovedPosition(unit, deltaX, deltaY);
      ref.current.x(x * px);
      ref.current.y(y * px);
    });

    e.target.x(clampedXm * px);
    e.target.y(clampedYm * px);

    setUnits((prev) =>
      prev.map((u) => {
        if (!movedIds.includes(u.id)) return u;
        const { x, y } = getMovedPosition(u, deltaX, deltaY);
        return { ...u, x, y };
      }),
    );
  }

  function handleDragEndGrid(e) {
    const stage = e.target.getStage();
    dispatch({
      type: CANVAS_ACTIONS.SET_STAGE_POS,
      payload: { x: stage.x(), y: stage.y() },
    });
  }

  // TRANSFORM

  function handleTransformEnd(e, unit) {
    const node = e.target;
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const rawWPx = unit.width * px * scaleX;
    const rawHPx = unit.height * px * scaleY;
    const snappedWPx = snapEnabled ? snapToGrid(rawWPx, snapSizePx) : rawWPx;
    const snappedHPx = snapEnabled ? snapToGrid(rawHPx, snapSizePx) : rawHPx;

    const minPx = 0.5 * px;
    const finalWPx = Math.max(minPx, snappedWPx);
    const finalHPx = Math.max(minPx, snappedHPx);

    // mandate anchor point not to fall off the top or left edge of the canvas
    // + anchor point must allow shape dimensions on the page (i.e. width and height)
    // edge case: if unit width/height exceeds canvas bounds
    const clampedXPx = Math.max(0, Math.min(node.x(), width - finalWPx));
    const clampedYPx = Math.max(0, Math.min(node.y(), height - finalHPx));
    // confirm shape dimensions are smaller than the canvas
    const isOutOfBounds = width < finalWPx || height < finalHPx;

    node.scaleX(1);
    node.scaleY(1);

    const newWidth = finalWPx / px;
    const newHeight = finalHPx / px;

    const isCustomShape =
      unit.type === "custom" && Array.isArray(unit.shape?.points) && unit.shape.points.length >= 3;

    const widthScale = unit.width > 0 ? newWidth / unit.width : 1;
    const heightScale = unit.height > 0 ? newHeight / unit.height : 1;

    const scaledPoints = isCustomShape
      ? unit.shape.points.map((point) => ({
        x: point.x * widthScale,
        y: point.y * heightScale,
      }))
      : null;

    const proposedUnit = {
      ...unit,
      x: clampedXPx / px,
      y: clampedYPx / px,
      width: newWidth,
      height: newHeight,
      shape: isCustomShape ? { ...unit.shape, points: scaledPoints } : unit.shape,
    };

    if (isOutOfBounds || checkCollisions(proposedUnit, unit.id)) {
      node.x(unit.x * px);
      node.y(unit.y * px);
      return;
    }

    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unit.id) return u;

        if (!isCustomShape) {
          return {
            ...u,
            x: proposedUnit.x,
            y: proposedUnit.y,
            width: newWidth,
            height: newHeight,
          };
        }

        return {
          ...u,
          x: proposedUnit.x,
          y: proposedUnit.y,
          width: newWidth,
          height: newHeight,

          shape: {
            ...u.shape,
            points: scaledPoints,
          },

          scale: {
            x: 1,
            y: 1,
          },
        };
      }),
    );

    node.x(clampedXPx);
    node.y(clampedYPx);
  }

  //  VIEWPORT

  function clampScale(scale) {
    return Math.min(CANVAS_CONFIG.MAX_SCALE, Math.max(CANVAS_CONFIG.MIN_SCALE, scale));
  }

  function handleWheel(e) {
    e.evt.preventDefault();

    const scaleFactor = 1.03;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const mouse = stage.getPointerPosition();

    const mouseLoc = {
      x: (mouse.x - stage.x()) / oldScale,
      y: (mouse.y - stage.y()) / oldScale,
    };

    const newScale = clampScale(e.evt.deltaY > 0 ? oldScale / scaleFactor : oldScale * scaleFactor);

    dispatch({ type: CANVAS_ACTIONS.SET_SCALE, payload: { scale: newScale } });

    stage.position({
      x: mouse.x - mouseLoc.x * newScale,
      y: mouse.y - mouseLoc.y * newScale,
    });
  }

  // Zooms toward the centre of the visible canvas (as opposed to handleWheel,
  // which zooms toward the pointer) - used by the +/- zoom buttons.
  function zoomByFactor(factor) {
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const newScale = clampScale(oldScale * factor);
    const center = { x: stage.width() / 2, y: stage.height() / 2 };
    const worldPoint = {
      x: (center.x - stage.x()) / oldScale,
      y: (center.y - stage.y()) / oldScale,
    };
    const newPos = {
      x: center.x - worldPoint.x * newScale,
      y: center.y - worldPoint.y * newScale,
    };

    dispatch({ type: CANVAS_ACTIONS.SET_SCALE, payload: { scale: newScale } });
    dispatch({ type: CANVAS_ACTIONS.SET_STAGE_POS, payload: newPos });
  }

  function handleZoomIn() {
    zoomByFactor(1.2);
  }

  function handleZoomOut() {
    zoomByFactor(1 / 1.2);
  }

  function handleFitToScreen() {
    const stage = stageRef.current;
    if (!stage) return;

    const displayW = stage.width();
    const displayH = stage.height();
    if (!displayW || !displayH || !width || !height) return;

    const PADDING = 0.9;
    const newScale = clampScale(Math.min(displayW / width, displayH / height) * PADDING);
    const newPos = {
      x: (displayW - width * newScale) / 2,
      y: (displayH - height * newScale) / 2,
    };

    dispatch({ type: CANVAS_ACTIONS.SET_SCALE, payload: { scale: newScale } });
    dispatch({ type: CANVAS_ACTIONS.SET_STAGE_POS, payload: newPos });
  }

  // COPY / PASTE / DUPLICATE

  // Places copies of `sourceUnits` offset diagonally from their originals, searching
  // for the first non-colliding spot. Shared by paste (from clipboard) and duplicate
  // (from the current selection).
  function placeOffsetCopies(sourceUnits) {
    const OFFSET = 1;
    const MAX_SEARCH = 100;

    const placedUnits = [];

    sourceUnits.forEach((unit) => {
      for (let step = 1; step <= MAX_SEARCH; step++) {
        const testX = unit.x + OFFSET * step;
        const testY = unit.y + OFFSET * step;

        const proposedUnit = { ...unit, x: testX, y: testY };

        // Make sure to check against newly placed units from this batch
        const collides = hasCollisions(proposedUnit, [...units, ...placedUnits]);

        if (!collides) {
          placedUnits.push({
            ...unit,
            id: `unit-${Date.now()}-${Math.random()}`,
            x: testX,
            y: testY,
          });
          break;
        }
      }
    });

    return placedUnits;
  }

  const handleCopy = useCallback(() => {
    const copied = units.filter((u) => selectedIds.has(u.id));
    dispatch({ type: CANVAS_ACTIONS.COPY_UNITS, payload: { units: copied } });
  }, [units, selectedIds]);

  const handlePaste = useCallback(() => {
    const placedUnits = placeOffsetCopies(clipboard);
    if (placedUnits.length === 0) return;

    setUnits((prev) => [...prev, ...placedUnits]);

    dispatch({
      type: CANVAS_ACTIONS.PASTE_UNITS,
      payload: { ids: placedUnits.map((u) => u.id) },
    });
  }, [clipboard, units]);

  const handleDuplicate = useCallback(() => {
    const selectedUnits = units.filter((u) => selectedIds.has(u.id));
    const placedUnits = placeOffsetCopies(selectedUnits);
    if (placedUnits.length === 0) return;

    setUnits((prev) => [...prev, ...placedUnits]);

    dispatch({
      type: CANVAS_ACTIONS.PASTE_UNITS,
      payload: { ids: placedUnits.map((u) => u.id) },
    });
  }, [units, selectedIds]);

  function handleDelete() {
    const idsToDelete = selectedIds;
    if (idsToDelete.size === 0) return;

    let unitsAsString = "";
    idsToDelete.forEach((id) => {
      const unit = units.find((u) => u.id === id);
      if (unit) unitsAsString += unit.name + " (" + id + ")\n";
    });
    unitsAsString = unitsAsString.slice(0, -1);
    if (!unitsAsString) return;

    const proceed = confirm(
      "Are you sure you want to delete the selected units: \n" + unitsAsString,
    );

    // stop if the user cancels
    if (!proceed) {
      return;
    }

    // filter units to only those that don't match the selected ID values
    setUnits((prev) => prev.filter((u) => !idsToDelete.has(u.id)));
    dispatch({ type: CANVAS_ACTIONS.DELETE_UNIT });
  }

  // RETURN
  return {
    getGroupRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleUnitClick,
    handleStageClick,
    handleDragMove,
    handleDragEnd,
    handleDragEndGrid,
    handleTransformEnd,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleDelete,
  };
}
