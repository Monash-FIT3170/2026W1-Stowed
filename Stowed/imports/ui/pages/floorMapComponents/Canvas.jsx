import {useRef, useState} from "react"
import {Stage, Layer, Rect, Line, Text, Group} from "react-konva";
import { COLOURS } from "./FloorMapStyles";
import { dragState } from "./DragState";

// TEMPORARY config, to be refactored and potentially replaced so it does not live here
export const CANVAS_CONFIG = {
  METERS_PER_CELL : 1,
  PIXELS_PER_METER : 50,
  GRID_SIZE : 50 * 1
}

// TEMPORARY storage unit for testing, replace with db fetch and simpleschema
function StorageUnit({unit, isSelected, onSelect, onDragEnd, onTransformEnd}) {
  return (
    <Group id={unit.id} x={unit.x} y={unit.y} onClick={onSelect} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd}>

      {/* MAIN BODY */}
      <Rect width={unit.width} height={unit.height} fill={unit.fill} stroke={isSelected ? "orange" : "transparent"} strokeWidth={2} cornerRadius={4} opacity={0.85}/> 

      {/* UNIT NAME ON BODY */}
      <Text y={unit.height / 2 - 7} width={unit.width} align="center" text={unit.name} fontSize={12} fill="white"/>

    </Group>
  );
}

// HELPER METHOD
function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
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
      vLines.push(<Text key={`vl-${x}`} x={x + 3} y={4} text={`${meters}m`} fontSize={10} fill="#888"/>);
    }
    for (let y = 0; y <= height; y += gridSizePx) {
      if (y === 0) continue;
      const meters = (y / CANVAS_CONFIG.PIXELS_PER_METER);
      hLines.push(<Line key={`h-${y}`} points={[0, y, width, y]} stroke="#ccc" strokeWidth={1}/>);
      hLines.push(<Text key={`hl-${y}`} x={4} y={y + 3} text={`${meters}m`} fontSize={10} fill="#888"/>);
    }
  }

  // --- GHOST HELPER ---
  // Browser blocks dataTransfer.getData for security reason. As such we must
  // build a "ghost" based on the template from dragState
  function buildGhostFromEvent(e) {
    const template = dragState.template;
    if (!template) return null;

    const stageBox = stageRef.current.container().getBoundingClientRect();
    const x = e.clientX - stageBox.left;
    const y = e.clientY - stageBox.top;

    const wPixels = template.width  * gridSizePx;
    const hPixels = template.height * gridSizePx;

    // Snap or free position depending on canvasSettings
    const rawX = x - wPixels / 2;
    const rawY = y - hPixels / 2;
    const snappedX = snapEnabled ? snapToGrid(rawX, gridSizePx) : rawX;
    const snappedY = snapEnabled ? snapToGrid(rawY, gridSizePx) : rawY;

    return { ...template, id: "ghost", x: snappedX, y: snappedY, width: wPixels, height: hPixels };
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

    // extract data from unitcard and parse
    const unitData = e.dataTransfer.getData("unit");
    if (!unitData) return;
    const template = JSON.parse(unitData);
    
    // get canvas position, obtain canvas relative coords
    const stageBox = stageRef.current.container().getBoundingClientRect();
    const x = e.clientX - stageBox.left;
    const y = e.clientY - stageBox.top;
    
    // convert m to px, snap position if enabled
    const wPixels = template.width  * gridSizePx;
    const hPixels = template.height * gridSizePx;
    const rawX = x - wPixels / 2;
    const rawY = y - hPixels / 2;
    const snappedX = snapEnabled ? snapToGrid(rawX, gridSizePx) : rawX;
    const snappedY = snapEnabled ? snapToGrid(rawY, gridSizePx) : rawY;
    
    // add unit to canvas
    setUnits((prev) => [ ...prev, { ...template, id: `unit-${Date.now()}`, x: snappedX, y: snappedY, width: wPixels, height: hPixels},]);
  }

  // --- STAGE HANDLERS ---
  function handleUnitClick(e, unit) {
    // Nothing here for now, to add selecting unit etc, fill in this method
  }

  function handleDragEnd(e, unitId) {
    // Place unit on snapped coord or free position if snap is off
    const rawX = e.target.x();
    const rawY = e.target.y();
    const snappedX = snapEnabled ? snapToGrid(rawX, gridSizePx) : rawX;
    const snappedY = snapEnabled ? snapToGrid(rawY, gridSizePx) : rawY;
    e.target.x(snappedX);
    e.target.y(snappedY);

    // Update unit position in state
    setUnits((prev) => prev.map((unit) => unit.id === unitId ? { ...unit, x: snappedX, y: snappedY } : unit));
  }


  // --- HTML ELEMENT ---
  return (
    // Stage cannot catch drop events so wrap in div.
    // wrapperRef is used by handleDragLeave to detect true canvas exits vs child-element transitions.
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
              onDragEnd={(e) => handleDragEnd(e, unit.id)}
              onTransformEnd={() => {}} // Add this method in when resizing objects, if we do that
            />
          ))}
        </Layer>

        {/* GHOST PREVIEW LAYER*/}
        <Layer>
          {ghostUnit && (
            <Group x={ghostUnit.x} y={ghostUnit.y}>
              {/* Actual Ghost */}
              <Rect width={ghostUnit.width} height={ghostUnit.height} fill={ghostUnit.fill} stroke="white" strokeWidth={2} dash={[6, 4]} cornerRadius={4} opacity={0.45}/>
              {/* Ghost label */}
              <Text y={ghostUnit.height / 2 - 7} width={ghostUnit.width} align="center" text={ghostUnit.name} fontSize={12} fill="white" opacity={0.7}/>
            </Group>
          )}
        </Layer>

      </Stage>
    </div>
  );
}