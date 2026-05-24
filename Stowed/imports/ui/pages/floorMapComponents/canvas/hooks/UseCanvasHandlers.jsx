import { useEditor } from "../editor/EditorContext";
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
*             handleDragEndGrid, handleTransformEnd, handleWheel, handleCopy, handlePaste, handleDelete }}
*/
export function useCanvasHandlers({ dispatch, units, setUnits, selectedIds, stageRef, groupRefs, snapEnabled, gridSizePx, gridInterval, width, height, activeTool, wrapperRef, clipboard, isCanvasEditMode }) {
  const navigate = useNavigate();
  const { setSelectedUnit, setIsPanelOpen } = useEditor();

  // INTERNAL HELPERS 
  function getGroupRef(id) {
    if (!groupRefs.current[id]) groupRefs.current[id] = { current: null };
    return groupRefs.current[id];
  }

  function checkCollisions(newBounds, excludeId = null) {
    return hasCollisions(newBounds, units, excludeId);
  }

  // Helper: get clamped bounds for any unit at an offset position
  function getMovedBounds(unit, deltaX, deltaY) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const newX = Math.max(0, Math.min(unit.x + deltaX, width  / px - unit.width));
    const newY = Math.max(0, Math.min(unit.y + deltaY, height / px - unit.height));
    return {
      bounds: {
        dom: { lower: newX * px, upper: (newX + unit.width)  * px },
        ran: { lower: newY * px, upper: (newY + unit.height) * px },
      },
      x: newX,
      y: newY,
    };
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
      dispatch( {type: CANVAS_ACTIONS.SELECT_UNIT, payload: { id: unit.id, shiftKey: e.evt.shiftKey }});
      return;
    }
    if (selectedIds.has(unit.id)) {
      dispatch({type: CANVAS_ACTIONS.DESELECT_ALL});
      return;
    }

    dispatch({type: CANVAS_ACTIONS.SELECT_UNIT, payload: { id: unit.id, shiftKey: e.evt.shiftKey }});
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
  
    dispatch({ type: CANVAS_ACTIONS.CLEAR_DRAG_OFFSETS });
  
    const draggedUnit = units.find((u) => u.id === unitId);
    if (!draggedUnit) return;

    const clampedXm = Math.max(0, Math.min(snappedXm, width  / px - draggedUnit.width));
    const clampedYm = Math.max(0, Math.min(snappedYm, height / px - draggedUnit.height));
  
    const deltaX = clampedXm - draggedUnit.x;
    const deltaY = clampedYm - draggedUnit.y;
  
    const movedIds = selectedIds.size > 1 && selectedIds.has(unitId)
      ? [...selectedIds]
      : [unitId];
  
    // Check all units that will move for collisions
    const wouldCollide = movedIds.some((id) => {
      const unit = units.find((u) => u.id === id);
      if (!unit) return false;
      const { bounds } = getMovedBounds(unit, deltaX, deltaY);
      return checkCollisions(bounds, id);
    });
  
    // Reset all units
    if (wouldCollide) {
      movedIds.forEach((id) => {
        const unit = units.find((u) => u.id === id);
        if (!unit) return;
        const ref = id === unitId ? { current: e.target } : getGroupRef(id);
        if (ref.current) { ref.current.x(unit.x * px); ref.current.y(unit.y * px); }
      });
      return;
    }
  
    movedIds.forEach((id) => {
      if (id === unitId) return;
      const unit = units.find((u) => u.id === id);
      const ref  = getGroupRef(id);
      if (!unit || !ref.current) return;
      const { x, y } = getMovedBounds(unit, deltaX, deltaY);
      ref.current.x(x * px);
      ref.current.y(y * px);
    });
  
    e.target.x(clampedXm * px);
    e.target.y(clampedYm * px);
  
    setUnits((prev) =>
      prev.map((u) => {
        if (!movedIds.includes(u.id)) return u;
        const { x, y } = getMovedBounds(u, deltaX, deltaY);
        return { ...u, x, y };
      })
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

    const scaleFactor = 1.03;
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
    const MAX_SEARCH = 100;
  
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const placedUnits = [];
  
    clipboard.forEach((unit) => {
      let found = false;
  
      for (let step = 1; step <= MAX_SEARCH; step++) {
        const testX = unit.x + OFFSET * step;
        const testY = unit.y + OFFSET * step;
  
        const bounds = {
          dom: { lower: testX * px, upper: (testX + unit.width) * px},
          ran: { lower: testY * px, upper: (testY + unit.height) * px}
        };
        
        // Make sure to check against newly placed units from paste
        const collides = hasCollisions(bounds, [...units, ...placedUnits]);
  
        if (!collides) {
          placedUnits.push({ ...unit, id: `unit-${Date.now()}-${Math.random()}`, x: testX, y: testY});
          found = true;
          break;
        }
      };
    });
      
    if (placedUnits.length === 0) return;
  
    setUnits((prev) => [ ...prev, ...placedUnits,]);
  
    dispatch({ type: CANVAS_ACTIONS.PASTE_UNITS, payload: { ids: placedUnits.map((u) => u.id)}});
    }, [clipboard, units]);
  

  function handleDelete(e) {
    const idsToDelete = selectedIds;
    if (idsToDelete.size === 0) return;

    let unitsAsString = "";
    idsToDelete.forEach((id) => {
      const unit = units.find((u) => u.id === id);
      if (unit) unitsAsString += unit.name + " (" + id + ")\n";
    });
    unitsAsString = unitsAsString.slice(0, -1);
    if (!unitsAsString) return;

    const proceed = confirm("Are you sure you want to delete the selected units: \n" + unitsAsString);

    // stop if the user cancels
    if (!proceed) { return; }

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
    handleCopy,
    handlePaste,
    handleDelete
  };
}
