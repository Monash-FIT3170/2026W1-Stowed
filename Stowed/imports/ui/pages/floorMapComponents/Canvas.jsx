import {useRef, useState} from "react"
import {Stage, Layer, Rect, Line, Text, Group} from "react-konva";
import { COLOURS } from "./FloorMapStyles";
import { dragState } from "./DragState";
import { useNavigate } from "react-router-dom";
import { isRectRectIntersecting } from "./UnitCollisions";

// TEMPORARY config, to be refactored and potentially replaced so it does not live here
export const CANVAS_CONFIG = {
  METERS_PER_CELL : 1,
  PIXELS_PER_METER : 50,
  GRID_SIZE : 50 * 1
}

// TEMPORARY storage unit for testing, replace with db fetch and simpleschema
function StorageUnit({unit, isSelected, onSelect, onTransformEnd}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  return (
    <Group id={unit.id} x={unit.x * px} y={unit.y * px} onClick={onSelect} onTransformEnd={onTransformEnd}>
      {/* MAIN BODY */}
      <Rect width={unit.width * px} height={unit.height * px} fill={unit.fill} stroke={isSelected ? "orange" : "transparent"} strokeWidth={2} cornerRadius={4} opacity={0.85}/>

      {/* UNIT NAME ON BODY */}
      <Text width={unit.width * px} height={unit.height * px} align="center" verticalAlign="middle" text={unit.name} fontSize={12} fill="white"/>
    </Group>
  );
}

// HELPER METHOD
function snapToGridMeters(value, gridInterval) {
  return Math.round(value / gridInterval) * gridInterval;
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
export function Canvas({ style, floorSize, activeTool, canvasSettings }) {
  const width = floorSize.width;
  const height = floorSize.height;

    // canvas settings may be undefined so fallback on CANVAS_CONFIG
  const gridInterval  = canvasSettings?.gridInterval ?? CANVAS_CONFIG.METERS_PER_CELL;
  const showGrid      = canvasSettings?.showGrid     ?? true;
  const snapEnabled   = canvasSettings?.snapToGrid   ?? true;
  const gridSizePx    = gridInterval * CANVAS_CONFIG.PIXELS_PER_METER;

  const stageRef  = useRef(null);
  const wrapperRef = useRef(null);
  
  const [units, setUnits] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // Not implemented
  const [ghostUnit, setGhostUnit] = useState(null);

  // --- BUILD GRID ---
  const vLines = [];
  const hLines = [];

  if (showGrid) {
    for (let x = 0; x <= width; x += gridSizePx) {
      if (x === 0) continue;
      const meters = (x / CANVAS_CONFIG.PIXELS_PER_METER);
      vLines.push(<Line key={`v-${x}`} points={[x, 0, x, height]} stroke="#ccc" strokeWidth={1}/>);
      vLines.push(<Text key={`vl-${x}`} x={x + 3} y={4} text={`${meters}m`} fontSize={10} fill="black"/>);
    }
    for (let y = 0; y <= height; y += gridSizePx) {
      if (y === 0) continue;
      const meters = (y / CANVAS_CONFIG.PIXELS_PER_METER);
      hLines.push(<Line key={`h-${y}`} points={[0, y, width, y]} stroke="#ccc" strokeWidth={1}/>);
      hLines.push(<Text key={`hl-${y}`} x={4} y={y + 3} text={`${meters}m`} fontSize={10} fill="black"/>);
    }
  }

  // --- GHOST HELPER ---
  function buildGhostFromEvent(e) {
    const template = dragState.template;
    if (!template) return null;

    const stageBox = stageRef.current.container().getBoundingClientRect();
    
    const xPx = e.clientX - stageBox.left;
    const yPx = e.clientY - stageBox.top;

    const xMeters = xPx / CANVAS_CONFIG.PIXELS_PER_METER;
    const yMeters = yPx / CANVAS_CONFIG.PIXELS_PER_METER;

    const wMeters = template.width;
    const hMeters = template.height;

    const rawXm = xMeters - wMeters / 2;
    const rawYm = yMeters - hMeters / 2;

    const snappedXm = snapEnabled ? snapToGridMeters(rawXm, gridInterval) : rawXm;
    const snappedYm = snapEnabled ? snapToGridMeters(rawYm, gridInterval) : rawYm;
    
    // --- DROP HANDLERS ---
    // convert bounds to pixels for collision detection
    const wPx = wMeters * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPX = hMeters * CANVAS_CONFIG.PIXELS_PER_METER;
    const snappedXPx = snappedXm * CANVAS_CONFIG.PIXELS_PER_METER;
    const snappedyPx = snappedYm * CANVAS_CONFIG.PIXELS_PER_METER;

    // define bounds for this unit
    const thisBounds = { dom: { lower: snappedXPx, upper: snappedXPx +wPx }, ran: { lower: snappedYPx, upper: snappedYPx + hPx} };
    // don't show ghost if there are collisions
    if (hasCollisions(thisBounds)) {
      setGhostUnit(null);
      return;
    }

    return { ...template, id: "ghost", x: snappedX, y: snappedY, width: wPixels, height: hPixels };
  }

  // --- COLLISION DETECT ---
  // Centralise collision logic to be used in handleDrop and buildGhostFromEvent
  function hasCollisions(newBounds) {
    const intersectsThis = isRectRectIntersecting(newBounds);

    // generate bounds for other units
    const coordRanges = units.map(
      ({ x, y, width, height }) => (
        { dom: { lower: x, upper: x + width }, ran: { lower: y, upper: y + height } }
      )
    );
    const anyIntersects = coordRanges
      .map(otherBound => intersectsThis(otherBound)) // check for collision with other unit
      .reduce((acc, i) => acc || i, false); // combine individual checks into single condition

    return anyIntersects;
  }

  // --- DROP HANDLERS ---
  function handleDragOver(e) {
    // Prevent page from reloading on drop
    e.preventDefault();

        // Update ghost preview position every time the cursor moves over the canvas
    const ghost = buildGhostFromEvent(e);
    if (ghost) setGhostUnit(ghost);
  }

  function handleDragLeave(e) {
    // Check the cursor has actually left the wrapper div before clearing the ghost.
    if (wrapperRef.current && wrapperRef.current.contains(e.relatedTarget)) return;
    setGhostUnit(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    // Clear ghost once the unit is placed
    setGhostUnit(null);

    const unitData = e.dataTransfer.getData("unit");
    if (!unitData) return;
    const template = JSON.parse(unitData);

    const stageBox = stageRef.current.container().getBoundingClientRect();
    const xPx = e.clientX - stageBox.left;
    const yPx = e.clientY - stageBox.top;

    const xMeters = xPx / CANVAS_CONFIG.PIXELS_PER_METER;
    const yMeters = yPx / CANVAS_CONFIG.PIXELS_PER_METER;

    const wMeters = template.width;
    const hMeters = template.height;

    const rawXm = xMeters - wMeters / 2;
    const rawYm = yMeters - hMeters / 2;

    const snappedXm = snapEnabled ? snapToGridMeters(rawXm, gridInterval) : rawXm;
    const snappedYm = snapEnabled ? snapToGridMeters(rawYm, gridInterval) : rawYm;
   
    // convert m to px, snap position
    const wPx = wMeters * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPx = hMeters * CANVAS_CONFIG.PIXELS_PER_METER;
    const snappedXPx = snappedXm * CANVAS_CONFIG.PIXELS_PER_METER;
    const snappedYPx = snappedYm * CANVAS_CONFIG.PIXELS_PER_METER;

    // define bounds for this unit
    const thisBounds = { dom: { lower: snappedXPx, upper: snappedXPx + wPx }, ran: { lower: snappedYPx, upper: snappedYPx + hPx }};
    if (hasCollisions(thisBounds)) return;

    // add unit to canvas
    setUnits((prev) => [ ...prev, { ...template, id: `unit-${Date.now()}`, x: snappedX, y: snappedY, width: wPixels, height: hPixels},]);
  }

  // --- STAGE HANDLERS ---
  function handleUnitClick(unit) {
  navigate(`/storage-unit/${unit._id}`);
  }

  // function handleDragEnd(e, unitId) {
  //   const px = CANVAS_CONFIG.PIXELS_PER_METER;

  //   const rawXm = e.target.x() / px;
  //   const rawYm = e.target.y() / px;

  //   const snappedXm = snapEnabled ? snapToGridMeters(rawXm, gridInterval) : rawXm;
  //   const snappedYm = snapEnabled ? snapToGridMeters(rawYm, gridInterval) : rawYm;

  //   e.target.x(snappedXm * px);
  //   e.target.y(snappedYm * px);

  //   // Update unit position in state
  //   setUnits(prev => prev.map(unit =>   unit.id === unitId     ? { ...unit, x: snappedXm, y: snappedYm }     : unit ));
  // }

  return (
    <div
      ref={wrapperRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{ display: "inline-block" }}
    >
      <Stage ref={stageRef} width={width} height={height} style={style}>
        
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
          {units.map((unit) => (
            <StorageUnit
              key={unit.id}
              unit={unit}
              isSelected={selectedId === unit.id}
              activeTool={activeTool}
              onSelect={(e) => handleUnitClick(e, unit)}
              onTransformEnd={() => {}} // Add this method in when resizing objects, if we do that
            />
          ))}
        </Layer>

        {/* GHOST PREVIEW LAYER*/}
        <Layer>
          {ghostUnit && (
            <Group x={ghostUnit.x * CANVAS_CONFIG.PIXELS_PER_METER} y={ghostUnit.y * CANVAS_CONFIG.PIXELS_PER_METER}>
              {/* Actual Ghost */}
              <Rect width={ghostUnit.width * CANVAS_CONFIG.PIXELS_PER_METER} height={ghostUnit.height * CANVAS_CONFIG.PIXELS_PER_METER} fill={ghostUnit.fill} stroke="white" strokeWidth={2} dash={[6, 4]} cornerRadius={4} opacity={0.45}/>
              {/* Ghost label */}
              <Text width={ghostUnit.width * CANVAS_CONFIG.PIXELS_PER_METER} height={ghostUnit.height * CANVAS_CONFIG.PIXELS_PER_METER} align="center" verticalAlign="middle" text={ghostUnit.name} fontSize={12} fill="white" opacity={0.7}/>
            </Group>
          )}
        </Layer>

      </Stage>
    </div>
  );
}