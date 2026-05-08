import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Transformer } from "react-konva";
import { COLOURS } from "./FloorMapStyles";
import { dragState } from "./canvas/editor/DragState";
import { useNavigate } from "react-router-dom";
import { isRectRectIntersecting } from "./canvas/editor/utils/UnitCollisions";

export const CANVAS_CONFIG = {
  METERS_PER_CELL : 1,
  PIXELS_PER_METER : 50,
  GRID_SIZE : 50 * 1,
};

// Controlled transformer that lives beside a selected unit.
function UnitTransformer({ nodeRef }) {
  const trRef = useRef(null);

  // Attach transformer to the Group node once both refs are ready.
  useState(() => {});

  return (
    <Transformer
      ref={trRef}
      nodes={nodeRef.current ? [nodeRef.current] : []}
      rotateEnabled={false}
      keepRatio={false}
      boundBoxFunc={(oldBox, newBox) => {
        // Enforce minimum size of 0.5 m × 0.5 m (in pixels)
        const minPx = 0.5 * CANVAS_CONFIG.PIXELS_PER_METER;
        if (newBox.width < minPx || newBox.height < minPx) return oldBox;
        return newBox;
      }}
    />
  );
}

function snapToGrid(value, snapInterval) {
  return Math.round(value / snapInterval) * snapInterval;
}

/**
 * Interactive canvas component built using react-konva
 * 
 * Features:
 *  - Grid rendering based on canvasSettings
 *  - Drag and drop unit placement with optional snap to grid  
 *  - Ghost snap preview while dragging units over canvas
 * 
 * @param {Object} style - Style config for canvas
 * @param {{ width: number, height: number}} floorSize - Dimension of canvas in pixels
 * @param {String} activeTool - Currently selected tool from FloorMapPage (e.g. "select", "move")
 * @param {{ gridInterval: number, showGrid: boolean, snapToGrid: boolean }} canvasSettings - Current canvas settings
 * 
 * @returns {JSX.Element} - React Konva canvas element 
 */
export function Canvas({ style, floorSize, activeTool, canvasSettings, units, setUnits, pendingUnit, onUnitPlaced }) {
  const width = floorSize.width;
  const height = floorSize.height;

  const gridInterval  = canvasSettings?.gridInterval ?? CANVAS_CONFIG.METERS_PER_CELL;
  const showGrid      = canvasSettings?.showGrid     ?? true;
  const snapEnabled   = canvasSettings?.snapToGrid   ?? true;
  const gridSizePx    = gridInterval * CANVAS_CONFIG.PIXELS_PER_METER;

  const stageRef  = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const groupRefs = useRef({});
  const containerRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [ghostUnit, setGhostUnit] = useState(null);
  const [dragOffsets, setDragOffsets] = useState({ deltaX: 0, deltaY: 0, unitId: null });
  const [scale, setScale] = useState(1); // scale state, default 1
  const [stagePos, setStagePos] = useState({ x:0, y:0}); //position of grid, default 0,0
  const [displaySize, setDisplaySize] = useState({width: 0, height: 0});
  
  // --- BUILD GRID ---
  const vLines = [];
  const hLines = [];
  
  if (showGrid) {
    for (let x = 0; x <= width; x += gridSizePx) {
      if (x === 0) continue;
      const meters = (x / CANVAS_CONFIG.PIXELS_PER_METER);
      vLines.push(<Line key={`v-${x}`} points={[x, 0, x, height]} stroke="#ccc" strokeWidth={1}/>);
      vLines.push(<Text key={`vl-${x}`} x={x - 23} y={4} text={`${meters}m`} fontSize={10} fill="black"/>);
    }
    for (let y = 0; y <= height; y += gridSizePx) {
      if (y === 0) continue;
      const meters = (y / CANVAS_CONFIG.PIXELS_PER_METER);
      hLines.push(<Line key={`h-${y}`} points={[0, y, width, y]} stroke="#ccc" strokeWidth={1}/>);
      hLines.push(<Text key={`hl-${y}`} x={4} y={y - 12} text={`${meters}m`} fontSize={10} fill="black"/>);
    }
  }
  
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setDisplaySize({ width, height });
  }, []);

  // Returns (or creates) a stable ref for a given unit id.
  function getGroupRef(id) {
    if (!groupRefs.current[id]) groupRefs.current[id] = { current: null };
    return groupRefs.current[id];
  }
  
  // --- GHOST HELPER ---
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
      dom: { lower: clampedX,           upper: clampedX + wPixels },
      ran: { lower: clampedY,           upper: clampedY + hPixels },
    };
    
    if (hasCollisions(thisBounds)) return null;
    
    return { ...template, id: "ghost", x: clampedX, y: clampedY, width: wPixels, height: hPixels };
  }
  
    // --- COLLISION DETECT ---
    // Centralise collision logic to be used in handleDrop and buildGhostFromEvent
    function hasCollisions(newBounds, excludeId = null) {
        const intersectsThis = isRectRectIntersecting(newBounds);

        const px = CANVAS_CONFIG.PIXELS_PER_METER;
        const anyIntersects = getOtherUnitBounds(excludeId).map((other) => intersectsThis(other)).reduce((acc, i) => acc || i, false);
        return anyIntersects;  
      }

    // Converts the units array to pixel space bounds
    function getOtherUnitBounds(excludeId) {
      const px = CANVAS_CONFIG.PIXELS_PER_METER;
      return units.filter((u) => u.id !== excludeId).map(({ x, y, width: w, height: h }) => ({
          dom: { lower: x * px, upper: (x + w) * px },
          ran: { lower: y * px, upper: (y + h) * px },
        }));
    }
  // --- DROP HANDLERS ---
  function handleDragOver(e) {
    // Prevent page from reloading on drop
    e.preventDefault();

    // Update ghost preview position every time the cursor moves over the canvas
    const ghost = buildGhostFromEvent(e);
    setGhostUnit(ghost ?? null);
  }

  function handleDragLeave(e) {
    // Check the cursor has actually left the wrapper div before clearing the ghost.
    if (wrapperRef.current?.contains(e.relatedTarget)) return;
    setGhostUnit(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    // Clear ghost once the unit is placed
    setGhostUnit(null);
    // extract data from unitcard and parse    
    const unitData = e.dataTransfer.getData("unit");
    if (!unitData) return;
    const template = JSON.parse(unitData);

    const stage = stageRef.current;
    const stageBox = stage.container().getBoundingClientRect();
    const pointer = {
      x: e.clientX - stageBox.left,
      y: e.clientY - stageBox.top
    }

    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();
    // convert m to px, snap position
    const wPixels = template.width  * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPixels = template.height * CANVAS_CONFIG.PIXELS_PER_METER;

    const snappedX = snapEnabled ? snapToGrid(x - wPixels / 2, gridSizePx) : (x - wPixels / 2);
    const snappedY = snapEnabled ? snapToGrid(y - hPixels / 2, gridSizePx) : (y - hPixels / 2);

    const pointInGrid = x >= 0 && y >= 0 && x <= width && y <= height;
    if (!pointInGrid) return;

    const clampedX = Math.max(0, Math.min(snappedX, width - wPixels));
    const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));

    const thisBounds = { dom: { lower: clampedX, upper: clampedX + wPixels }, ran: { lower: clampedY, upper: clampedY + hPixels } };
    if (hasCollisions(thisBounds)) return;
    // add unit to canvas
    setUnits((prev) => [...prev, {
        ...template,
        id: `unit-${Date.now()}`,
        x: clampedX / CANVAS_CONFIG.PIXELS_PER_METER,
        y: clampedY / CANVAS_CONFIG.PIXELS_PER_METER,
        width: template.width,
        height: template.height,
      }]);
  }

  // --- STAGE HANDLERS ---
  function handleUnitClick(unit, e) {
    if (activeTool === "inspect") {
      navigate(`/storage-unit/${unit._id}`);
      return;
    }

    // Toggle selection; clicking background deselects (see handleStageClick).
    if (!e.evt.shiftKey) {
      setSelectedIds(new Set([unit.id]));
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(unit.id) ? next.delete(unit.id) : next.add(unit.id);
      return next;
    });
    return;
  }
  

  // Deselect when clicking the background.
  function handleStageClick(e) {
    if (e.target === e.target.getStage()) setSelectedIds(new Set());
  }

  function handleDragEnd(e, unitId) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const rawXm = e.target.x() / px;
    const rawYm = e.target.y() / px;

    const snappedXm = snapEnabled ? snapToGrid(rawXm, gridInterval) : rawXm;
    const snappedYm = snapEnabled ? snapToGrid(rawYm, gridInterval) : rawYm;

    e.target.x(snappedXm * px);
    e.target.y(snappedYm * px);

    // HANDLE MULTIPLE UNITS

    // Clear ghost offsets on drag end.
    setDragOffsets({ deltaX: 0, deltaY: 0, unitId: null });

    // If multiple units selected, move all selected units by the same offset
    if (selectedIds.size > 1 && selectedIds.has(unitId)) {
      const draggedUnit = units.find((u) => u.id === unitId);
      const deltaX = snappedXm - draggedUnit.x;
      const deltaY = snappedYm - draggedUnit.y;
      
      // Check collisions for every selected unit
      const wouldCollide = [...selectedIds].some((id) => {
        const unit = units.find((u) => u.id === id);
        if (!unit) return false;
        const newXPx = (unit.x + deltaX) * px;
        const newYPx = (unit.y + deltaY) * px;
        const bounds = { dom: { lower: newXPx, upper: newXPx + unit.width * px }, ran: { lower: newYPx, upper: newYPx + unit.height * px } };
        return hasCollisions(bounds, id);
      });

      // If any unit would collide, snap all nodes back
      if (wouldCollide) {
        [...selectedIds].forEach((id) => {
          const ref = getGroupRef(id);
          if (!ref.current) return;
          const unit = units.find((u) => u.id === id);
          ref.current.x(unit.x * px);
          ref.current.y(unit.y * px);
        });
        return;
      }

      // Sync non-dragged selected nodes to their new positions
      [...selectedIds].forEach((id) => {
        if (id === unitId) return;
        const ref = getGroupRef(id);
        if (!ref.current) return;
        const unit = units.find((u) => u.id === id);
        ref.current.x((unit.x + deltaX) * px);
        ref.current.y((unit.y + deltaY) * px);
      });

      setUnits((prev) => prev.map((u) => selectedIds.has(u.id)
        ? { ...u, x: u.x + deltaX, y: u.y + deltaY }
        : u
      ));
      return;
    }

    // Update unit position in state
    setUnits(prev => prev.map(unit => unit.id === unitId ? { ...unit, x: snappedXm, y: snappedYm } : unit));
  }


  function handleDragMove(e, unitId) {
    // Only mirror movement when multiple units are selected.
    if (selectedIds.size <= 1 || !selectedIds.has(unitId)) return;

    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const draggedUnit = units.find((u) => u.id === unitId);

    const deltaX = (e.target.x() / px) - draggedUnit.x;
    const deltaY = (e.target.y() / px) - draggedUnit.y;

    // Track delta in state so ghost layer can read it.
    setDragOffsets({ deltaX, deltaY, unitId });

    // Move all other selected nodes visually without updating state.
    [...selectedIds].forEach((id) => {
      if (id === unitId) return;
      const ref = getGroupRef(id);
      if (!ref.current) return;
      const unit = units.find((u) => u.id === id);
      ref.current.x((unit.x + deltaX) * px);
      ref.current.y((unit.y + deltaY) * px);
    });
  }


  function handleDragEndGrid(e) {
    const stage = e.target.getStage();
    setStagePos({x: stage.x(), y: stage.y()});
  }

  // --- TRANSFORMERS ---
  // Apply scaling to group when the Tranformer handle is dragged.
  // Read scales, compute pixel dimensions, convert to meters and check for collisions.
  // If collisions reset unit state to original otherwise update.
  function handleTransformEnd(e, unit) {
    const node = e.target;
    const px   = CANVAS_CONFIG.PIXELS_PER_METER;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Compute proposed new dimensions in pixels, then snap to grid
    const rawWPx = unit.width  * px * scaleX;
    const rawHPx = unit.height * px * scaleY;
    const snappedWPx = snapEnabled ? snapToGrid(rawWPx, gridSizePx) : rawWPx;
    const snappedHPx = snapEnabled ? snapToGrid(rawHPx, gridSizePx) : rawHPx;

    // Enforce minimum size (0.5 m).
    const minPx = 0.5 * px;
    const finalWPx = Math.max(minPx, snappedWPx);
    const finalHPx = Math.max(minPx, snappedHPx);

    const newXPx = node.x();
    const newYPx = node.y();

    // Clamp position so the unit stays within canvas bounds.
    const clampedXPx = Math.max(0, Math.min(newXPx, width  - finalWPx));
    const clampedYPx = Math.max(0, Math.min(newYPx, height - finalHPx));

    const proposedBounds = {dom: { lower: clampedXPx, upper: clampedXPx + finalWPx },ran: { lower: clampedYPx, upper: clampedYPx + finalHPx }};

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    if (hasCollisions(proposedBounds, unit.id)) {
      // Snap the node back to its original position and leave state unchanged.
      node.x(unit.x * px);
      node.y(unit.y * px);
      return;
    }

    // Otherwise commit new dimensions and position to state.
    setUnits((prev) => prev.map((u) => u.id === unit.id ? {
              ...u,
              x:      clampedXPx / px,
              y:      clampedYPx / px,
              width:  finalWPx   / px,
              height: finalHPx   / px,
            }
          : u
      )
    );

    // Sync the node's position to the clamped value.
    node.x(clampedXPx);
    node.y(clampedYPx);
  }

  function handleWheel(e) {

    e.evt.preventDefault();

    const scaleFactor = 1.01;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();

    const mouse = stage.getPointerPosition();
    
    // Get mouse location
    const mouseLoc = {
      x: (mouse.x - stage.x()) / oldScale,
      y: (mouse.y - stage.y()) / oldScale
    };

    // if wheeling up then zoom in otherwise zoom out
    const newScale = e.evt.deltaY > 0
      ? oldScale / scaleFactor
      : oldScale * scaleFactor;

    // sets scale
    setScale(newScale);

    // gets new position of stage after zoom
    const newPos = {
      x: mouse.x - mouseLoc.x * newScale,
      y: mouse.y - mouseLoc.y * newScale
    }

    stage.position(newPos);
  }


  return (
    // Stage cannot catch drop events so wrap in div
    <div ref={wrapperRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} style={{ width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{width: "100%", height: "100%"}}>
        <Stage ref={stageRef} width={displaySize.width} height={displaySize.height} scaleX={scale} scaleY={scale} onWheel={handleWheel} style={style} draggable x={stagePos.x} y={stagePos.y} onDragEnd={handleDragEndGrid} onClick={handleStageClick}>
          {/* BASE CANVAS LAYER */}
          <Layer>
            {/* BACKGROUND */}
            <Rect x={0} y={0} width={width} height={height} fill={COLOURS.CANVAS_FILL}/>

            {/* GRID LINES */}
            {vLines}
            {hLines}
          </Layer>

          {/* STORAGE UNIT LAYER */}
          <Layer>
            {units.map((unit) => {
              const ref = getGroupRef(unit.id);
              return (
                <StorageUnit key={unit.id} unit={unit} isSelected={selectedIds.has(unit.id)} activeTool={activeTool} onSelect={(e) => handleUnitClick(unit, e)} onDragMove={(e) => handleDragMove(e, unit.id)} onDragEnd={(e) => handleDragEnd(e, unit.id)} onTransformEnd={(e) => handleTransformEnd(e, unit)} groupRef={(node) => { ref.current = node; }}/>              );})}

            {/* TRANSFORMER */}
            {selectedIds.size > 0 && selectedIds.size < 2 && (() => {
              const nodes = [...selectedIds].map((id) => getGroupRef(id).current).filter(Boolean);
              return nodes.length > 0 ? (
                <Transformer
                  nodes={nodes}
                  rotateEnabled={false}
                  keepRatio={false}
                  boundBoxFunc={(oldBox, newBox) => {
                    const minPx = 0.5 * CANVAS_CONFIG.PIXELS_PER_METER;
                    if (newBox.width < minPx || newBox.height < minPx) return oldBox;
                    return newBox;
                  }}
                />
              ) : null;
            })()}
          </Layer>

          {/* GHOST PREVIEW LAYER */}
          <Layer>
            {ghostUnit && (
              <Group x={ghostUnit.x} y={ghostUnit.y}>
                {/* Actual Ghost */}
                <Rect width={ghostUnit.width} height={ghostUnit.height} fill={ghostUnit.fill} stroke="white" strokeWidth={2} dash={[6, 4]} cornerRadius={4} opacity={0.45}/>
                {/* Ghost label */}
                <Text width={ghostUnit.width} height={ghostUnit.height} align="center" verticalAlign="middle" text={ghostUnit.name} fontSize={12} fill="white" opacity={0.7}/>
              </Group>
            )}

            {/* MULTI-DRAG GHOSTS  rendered for all selected units except the one being dragged */}
            {dragOffsets.unitId && [...selectedIds]

              .map((id) => {
                const unit = units.find((u) => u.id === id);
                if (!unit) return null;
                const px = CANVAS_CONFIG.PIXELS_PER_METER;
                let ghostX = (unit.x + dragOffsets.deltaX) * px;
                let ghostY = (unit.y + dragOffsets.deltaY) * px;
                if (snapEnabled) {
                  ghostX = snapToGrid(ghostX, gridSizePx);
                  ghostY = snapToGrid(ghostY, gridSizePx);
                }

                return (
                  <Group key={`ghost-${id}`} x={ghostX} y={ghostY}>
                    {/* Multi-drag ghost body */}
                    <Rect width={unit.width * px} height={unit.height * px} fill={unit.fill} stroke="white" strokeWidth={2} dash={[6, 4]} cornerRadius={4} opacity={0.45}/>
                    {/* Multi-drag ghost label */}
                    <Text width={unit.width * px} height={unit.height * px} align="center" verticalAlign="middle" text={unit.name} fontSize={12} fill="white" opacity={0.7}/>
                  </Group>
                );
              })
            }
          </Layer>

        </Stage>
    </div>
  </div>
  );
}