import { useNavigate }    from "react-router-dom";
import { useCallback }    from "react";
import { CANVAS_ACTIONS } from "../editor/Actions";
import { snapToGrid }     from "../editor/utils/Snapping";
import { hasCollisions }  from "../editor/utils/Collisions";
import { dragState }      from "../editor/DragState";
import { CANVAS_CONFIG }  from "../CanvasConfig";


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
 * @param {number}      gridSizePx
 * @param {number}      gridInterval    - Snap interval in metres
 * @param {number}      width           - Floor width in pixels
 * @param {number}      height          - Floor height in pixel.
 * @param {string}      activeTool
 * @param {React.Ref}   wrapperRef
 *
 * @returns {{ getGroupRef, handleDragOver, handleDragLeave, handleDrop,
*             handleUnitClick, handleStageClick, handleDragMove, handleDragEnd,
*             handleDragEndGrid, handleTransformEnd, handleWheel }}
*/
export function useCanvasHandlers({ dispatch, units, setUnits, selectedIds, stageRef, groupRefs, snapEnabled, gridSizePx, gridInterval, width, height, activeTool, wrapperRef, clipboard }) {
  const navigate = useNavigate();

  // INTERNAL HELPERS 
  function getGroupRef(id) {
    if (!groupRefs.current[id]) groupRefs.current[id] = { current: null };
    return groupRefs.current[id];
  }

  function checkCollisions(newBounds, excludeId = null) {
    return hasCollisions(newBounds, units, excludeId);
  }

  function buildGhostFromEvent(e) {
    const template = dragState.template;
    if (!template) return null;

    const stage    = stageRef.current;
    const stageBox = stage.container().getBoundingClientRect();
    const pointer  = { x: e.clientX - stageBox.left, y: e.clientY - stageBox.top };

    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();

    const wPixels = template.width  * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPixels = template.height * CANVAS_CONFIG.PIXELS_PER_METER;

    const snappedX = snapEnabled ? snapToGrid(x - wPixels / 2, gridSizePx) : x - wPixels / 2;
    const snappedY = snapEnabled ? snapToGrid(y - hPixels / 2, gridSizePx) : y - hPixels / 2;

    const pointInGrid = x >= 0 && y >= 0 && x <= width && y <= height;
    if (!pointInGrid) return null;

    const clampedX = Math.max(0, Math.min(snappedX, width  - wPixels));
    const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));

    const thisBounds = {
      dom: { lower: clampedX, upper: clampedX + wPixels },
      ran: { lower: clampedY, upper: clampedY + hPixels },
    };

    if (checkCollisions(thisBounds)) return null;

    return { ...template, id: "ghost", x: clampedX, y: clampedY, width: wPixels, height: hPixels };
  }

  // DROP HANDLERS 

  function handleDragOver(e) {
    e.preventDefault();
    const ghost = buildGhostFromEvent(e);
    dispatch({ type: CANVAS_ACTIONS.SET_GHOST, payload: { ghost: ghost ?? null } });
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

    const stage    = stageRef.current;
    const stageBox = stage.container().getBoundingClientRect();
    const pointer  = { x: e.clientX - stageBox.left, y: e.clientY - stageBox.top };

    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();

    const wPixels = template.width  * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPixels = template.height * CANVAS_CONFIG.PIXELS_PER_METER;

    const snappedX = snapEnabled ? snapToGrid(x - wPixels / 2, gridSizePx) : x - wPixels / 2;
    const snappedY = snapEnabled ? snapToGrid(y - hPixels / 2, gridSizePx) : y - hPixels / 2;

    const pointInGrid = x >= 0 && y >= 0 && x <= width && y <= height;
    if (!pointInGrid) return;

    const clampedX = Math.max(0, Math.min(snappedX, width  - wPixels));
    const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));

    const thisBounds = {
      dom: { lower: clampedX, upper: clampedX + wPixels },
      ran: { lower: clampedY, upper: clampedY + hPixels },
    };
    if (checkCollisions(thisBounds)) return;

    setUnits((prev) => [
      ...prev,
      {
        ...template,
        id:     `unit-${Date.now()}`,
        x:      clampedX / CANVAS_CONFIG.PIXELS_PER_METER,
        y:      clampedY / CANVAS_CONFIG.PIXELS_PER_METER,
        width:  template.width,
        height: template.height,
      },
    ]);
  }

  // STAGE / UNIT HANDLERS 

  function handleUnitClick(unit, e) {
    if (activeTool === "inspect") {
      navigate(`/storage-unit/${unit._id}`);
      return;
    }
    dispatch({
      type:    CANVAS_ACTIONS.SELECT_UNIT,
      payload: { id: unit.id, shiftKey: e.evt.shiftKey },
    });
  }

  function handleStageClick(e) {
    if (e.target === e.target.getStage()) {
      dispatch({ type: CANVAS_ACTIONS.DESELECT_ALL });
    }
  }

  function handleDragMove(e, unitId) {
    if (selectedIds.size <= 1 || !selectedIds.has(unitId)) return;

    const px          = CANVAS_CONFIG.PIXELS_PER_METER;
    const draggedUnit = units.find((u) => u.id === unitId);
    const deltaX      = e.target.x() / px - draggedUnit.x;
    const deltaY      = e.target.y() / px - draggedUnit.y;

    dispatch({
      type:    CANVAS_ACTIONS.SET_DRAG_OFFSETS,
      payload: { deltaX, deltaY, unitId },
    });

    // Do not use dispatch for ref.current for performance
    [...selectedIds].forEach((id) => {
      if (id === unitId) return;
      const ref  = getGroupRef(id);
      const unit = units.find((u) => u.id === id);
      if (!ref.current || !unit) return;
      ref.current.x((unit.x + deltaX) * px);
      ref.current.y((unit.y + deltaY) * px);
    });
  }

  function handleDragEnd(e, unitId) {
    const px      = CANVAS_CONFIG.PIXELS_PER_METER;
    const rawXm   = e.target.x() / px;
    const rawYm   = e.target.y() / px;
    const snappedXm = snapEnabled ? snapToGrid(rawXm, gridInterval) : rawXm;
    const snappedYm = snapEnabled ? snapToGrid(rawYm, gridInterval) : rawYm;

    e.target.x(snappedXm * px);
    e.target.y(snappedYm * px);

    dispatch({ type: CANVAS_ACTIONS.CLEAR_DRAG_OFFSETS });

    // Multi-select move
    if (selectedIds.size > 1 && selectedIds.has(unitId)) {
      const draggedUnit = units.find((u) => u.id === unitId);
      const deltaX = snappedXm - draggedUnit.x;
      const deltaY = snappedYm - draggedUnit.y;

      const wouldCollide = [...selectedIds].some((id) => {
        const unit = units.find((u) => u.id === id);
        if (!unit) return false;
        const newXPx = (unit.x + deltaX) * px;
        const newYPx = (unit.y + deltaY) * px;
        const bounds = {
          dom: { lower: newXPx, upper: newXPx + unit.width  * px },
          ran: { lower: newYPx, upper: newYPx + unit.height * px },
        };
        return checkCollisions(bounds, id);
      });


      // Do not use dispatch for ref.current due to performance
      if (wouldCollide) {
        [...selectedIds].forEach((id) => {
          const ref  = getGroupRef(id);
          const unit = units.find((u) => u.id === id);
          if (!ref.current || !unit) return;
          ref.current.x(unit.x * px);
          ref.current.y(unit.y * px);
        });
        return;
      }

      [...selectedIds].forEach((id) => {
        if (id === unitId) return;
        const ref  = getGroupRef(id);
        const unit = units.find((u) => u.id === id);
        if (!ref.current || !unit) return;
        ref.current.x((unit.x + deltaX) * px);
        ref.current.y((unit.y + deltaY) * px);
      });

      setUnits((prev) =>
        prev.map((u) =>
          selectedIds.has(u.id) ? { ...u, x: u.x + deltaX, y: u.y + deltaY } : u
        )
      );
      return;
    }

    // Single unit move
    setUnits((prev) =>
      prev.map((u) => u.id === unitId ? { ...u, x: snappedXm, y: snappedYm } : u)
    );
  }

  function handleDragEndGrid(e) {
    const stage = e.target.getStage();
    dispatch({
      type:    CANVAS_ACTIONS.SET_STAGE_POS,
      payload: { x: stage.x(), y: stage.y() },
    });
  }

  // TRANSFORM 

  function handleTransformEnd(e, unit) {
    const node   = e.target;
    const px     = CANVAS_CONFIG.PIXELS_PER_METER;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const rawWPx     = unit.width  * px * scaleX;
    const rawHPx     = unit.height * px * scaleY;
    const snappedWPx = snapEnabled ? snapToGrid(rawWPx, gridSizePx) : rawWPx;
    const snappedHPx = snapEnabled ? snapToGrid(rawHPx, gridSizePx) : rawHPx;

    const minPx    = 0.5 * px;
    const finalWPx = Math.max(minPx, snappedWPx);
    const finalHPx = Math.max(minPx, snappedHPx);

    const clampedXPx = Math.max(0, Math.min(node.x(), width  - finalWPx));
    const clampedYPx = Math.max(0, Math.min(node.y(), height - finalHPx));

    const proposedBounds = {
      dom: { lower: clampedXPx, upper: clampedXPx + finalWPx },
      ran: { lower: clampedYPx, upper: clampedYPx + finalHPx },
    };

    node.scaleX(1);
    node.scaleY(1);

    if (checkCollisions(proposedBounds, unit.id)) {
      node.x(unit.x * px);
      node.y(unit.y * px);
      return;
    }

    setUnits((prev) =>
      prev.map((u) =>
        u.id === unit.id
          ? { ...u, x: clampedXPx / px, y: clampedYPx / px, width: finalWPx / px, height: finalHPx / px }
          : u
      )
    );

    node.x(clampedXPx);
    node.y(clampedYPx);
  }

  //  VIEWPORT

  function handleWheel(e) {
    e.evt.preventDefault();

    const scaleFactor = 1.01;
    const stage       = stageRef.current;
    const oldScale    = stage.scaleX();
    const mouse       = stage.getPointerPosition();

    const mouseLoc = {
      x: (mouse.x - stage.x()) / oldScale,
      y: (mouse.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0
      ? oldScale / scaleFactor
      : oldScale * scaleFactor;

    dispatch({ type: CANVAS_ACTIONS.SET_SCALE, payload: { scale: newScale } });

    stage.position({
      x: mouse.x - mouseLoc.x * newScale,
      y: mouse.y - mouseLoc.y * newScale,
    });
  }

  // COPY / PASTE

  const handleCopy = useCallback(() => {
    const copied = units.filter((u) => selectedIds.has(u.id));
    dispatch({ type: CANVAS_ACTIONS.COPY_UNITS, payload: { units: copied } });
  }, [units, selectedIds]);

  const handlePaste = useCallback(() => {
    const OFFSET = 1;
    const newUnits = clipboard.map((u) => ({
      ...u,
      id: `unit-${Date.now()}-${Math.random()}`,
      x:  u.x + OFFSET,
      y:  u.y + OFFSET,
    }));

    const safe = newUnits.filter((u) => {
      const px = CANVAS_CONFIG.PIXELS_PER_METER;
      const bounds = {
        dom: { lower: u.x * px, upper: (u.x + u.width)  * px },
        ran: { lower: u.y * px, upper: (u.y + u.height) * px },
      };
      return !checkCollisions(bounds);
    });

    if (safe.length === 0) return;
    setUnits((prev) => [...prev, ...safe]);
    dispatch({ type: CANVAS_ACTIONS.PASTE_UNITS, payload: { ids: safe.map((u) => u.id) } });
  }, [clipboard, units]);
  

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
    handleCopy,
    handlePaste,
  };
}