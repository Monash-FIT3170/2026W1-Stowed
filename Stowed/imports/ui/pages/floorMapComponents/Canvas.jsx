import {useRef, useState} from "react"
import {Stage, Layer, Rect, Line, Text, Group} from "react-konva";
import { COLOURS } from "./FloorMapStyles";

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
      <Text y={unit.height / 2 - 7} width={unit.width} align="center"text= {unit.name} fontSize={12} fill="white"/>

    </Group>
  );
}

// HELPER METHOD
function snapToGrid(value) {
  return Math.round(value / CANVAS_CONFIG.GRID_SIZE) * CANVAS_CONFIG.GRID_SIZE;
}

/**
 * Interactive canvas component built using react-konva
 * 
 * Features:
 *  - Grid rendering based on CANVIS_CONFIG
 *  - Drag and drop unit placement
 *  - Grid snapping for position
 *  - Internal state management for placed units
 *  
 * @param {Object} style - Style config for canvas
 * @param {{ width: number, height: number}} floorSize - Dimension of canvas in pixels
 * @param {String} activeTool - Currently selected tool from FloorMapPage (e.g. "select", "move")
 * 
 * @returns {JSX.Element} - React Konva canvas element 
 */
export function Canvas({ style, floorSize, activeTool }) {
  const width = floorSize.width;
  const height = floorSize.height;
  const gridSize = CANVAS_CONFIG.GRID_SIZE;
  const metersPerCell = CANVAS_CONFIG.METERS_PER_CELL;
  const stageRef = useRef(null);
  
  const [units, setUnits] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // Not implemented

  // --- BUILD GRID ---
  const vLines = [];
  for (let x = 0; x <= width; x += gridSize) {
    if (x === 0) continue;
    const meters = (x / gridSize) * metersPerCell;
    vLines.push(<Line key={`v-${x}`} points={[x, 0, x, height]} stroke="#ccc" strokeWidth={1}/>);
    vLines.push(<Text key={`vl-${x}`} x={x + 3} y={4} text={`${meters}m`} fontSize={10} fill={CANVAS_CONFIG.TEXT_COLOUR}/>);
  }

  const hLines=[]
  for (let y = 0; y <= height; y += gridSize) {
    if (y === 0) continue;
    const meters = (y / gridSize) * metersPerCell;
    hLines.push(<Line key={`h-${y}`} points={[0, y, width, y]} stroke="#ccc" strokeWidth={1}/>);
    hLines.push(<Text key={`hl-${y}`} x={4} y={y + 3} text={`${meters}m`} fontSize={10} fill={CANVAS_CONFIG.TEXT_COLOUR}/>);
  }

  // --- DROP HANDLERS ---
  function handleDragOver(e) {
    // prevent page from reloading
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    
    // extract data from unitcard and parse
    const unitData = e.dataTransfer.getData("unit");
    if (!unitData) return;
    const template = JSON.parse(unitData);
    
    // get canvas position, obtain canvas relative coords
    const stageBox = stageRef.current.container().getBoundingClientRect();
    const x = e.clientX - stageBox.left;
    const y = e.clientY - stageBox.top;
    
    // convert m to px, snap position
    const wPixels = template.width  * CANVAS_CONFIG.GRID_SIZE;
    const hPixels = template.height * CANVAS_CONFIG.GRID_SIZE;
    const snappedX = snapToGrid(x - wPixels / 2, CANVAS_CONFIG.GRID_SIZE);
    const snappedY = snapToGrid(y - hPixels / 2, CANVAS_CONFIG.GRID_SIZE);
    
    // add unit to canvas
    setUnits((prev) => [ ...prev, { ...template, id: `unit-${Date.now()}`, x: snappedX, y: snappedY, width: wPixels, height: hPixels},]);
  }

  // --- STAGE HANDLERS ---
  function handleUnitClick(e, unit) {
    // Nothing here for now, to add selecting unit etc, fill in this method
  }

  function handleDragEnd(e, unitId) {
    // place unit on snapped coord
    const snappedX = snapToGrid(e.target.x(), gridSize);
    const snappedY = snapToGrid(e.target.y(), gridSize);
    e.target.x(snappedX);
    e.target.y(snappedY);

    // add unit to canvas
    setUnits((prev) => prev.map((unit) => unit.id === unitId ? { ...unit, x: snappedX, y: snappedY } : unit));
  }


  // --- HTML ELEMENT ---
  return (
    // Stage cannot catch drop events so wrap in div
    <div onDrop={handleDrop} onDragOver={handleDragOver} style={{display:"inline-block"}}>

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

      </Stage>
    </div>
  );
}
