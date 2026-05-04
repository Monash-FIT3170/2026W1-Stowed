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
  const navigate = useNavigate();
  
  const [units, setUnits] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // Not implemented
  const [ghostUnit, setGhostUnit] = useState(null);
  const [scale, setScale] = useState(1); // scale state, default 1
  const [stagePos, setStagePos] = useState({ x:0, y:0}); //position of grid, default 0,0

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

    const stage = stageRef.current;
    const stageBox = stage.container().getBoundingClientRect();

    const pointer = {
      x: e.clientX - stageBox.left,
      y: e.clientY - stageBox.top
    }

    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();

    const wPixels = template.width  * CANVAS_CONFIG.PIXELS_PER_METER;
    const hPixels = template.height * CANVAS_CONFIG.PIXELS_PER_METER;

    // snap object such that the mouse is in the middle of the object
    const snappedX = snapEnabled ? snapToGrid(x - wPixels / 2, gridSizePx) : (x - wPixels / 2); 
    const snappedY = snapEnabled ? snapToGrid(y - hPixels / 2, gridSizePx) : (y - hPixels / 2);

    // define bounds for this unit
    const thisBounds = { dom: { lower: snappedX, upper: snappedX + wPixels }, ran: { lower: snappedY, upper: snappedY + hPixels } };
    // don't show ghost if there are collisions
    if (hasCollisions(thisBounds)) {
      setGhostUnit(null);
      return;
    }


    const pointInGrid =
      x >= 0 &&
      y >= 0 &&
      x <= width &&
      y <= height;

    // keeps unit in grid
    const clampedX = Math.max(0, Math.min(snappedX, width - wPixels));
    const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));
    


    if (!pointInGrid) return null;

    return { ...template, id: "ghost", x: clampedX, y: clampedY, width: wPixels, height: hPixels };
  }

  // --- COLLISION DETECT ---
  // Centralise collision logic to be used in handleDrop and buildGhostFromEvent
  function hasCollisions(newBounds) {
    const intersectsThis = isRectRectIntersecting(newBounds);

    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    const coordRanges = units.map(
      ({ x, y, width, height }) => (
        { dom: { lower: x * px, upper: (x + width) * px }, ran: { lower: y * px, upper: (y + height) * px } }
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
    if (ghost) {
      setGhostUnit(ghost);}
    else {
      setGhostUnit(null);
    }
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
    
    const pointInGrid = x >= 0 && y >= 0 && x <= width &&y <= height;

    if (!pointInGrid) return null;

    // keeps unit in grid
    const clampedX = Math.max(0, Math.min(snappedX, width - wPixels));
    const clampedY = Math.max(0, Math.min(snappedY, height - hPixels));

    // define bounds for this unit
    const thisBounds = { dom: { lower: snappedX, upper: snappedX + wPixels }, ran: { lower: snappedY, upper: snappedY + hPixels } };
    // don't add if there are collisions
    if (hasCollisions(thisBounds)) return;

     // add unit to canvas
     setUnits((prev) => [ ...prev, { ...template, id: `unit-${Date.now()}`, x: clampedX, y: clampedY, width: wPixels, height: hPixels},]);
  }

  // --- STAGE HANDLERS ---
  function handleUnitClick(unit) {
    navigate(`/storage-unit/${unit._id}`);
  }


  function handleDragEnd(e, unitId) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;

  function handleDragEndGrid(e) {
    const stage = e.target.getStage();
    setStagePos({x: stage.x(), y: stage.y()});
  }

  // handler for wheeling, which causes the stage to zoom in or out
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
    <div ref={wrapperRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} style={{display:"inline-block"}}>
      <Stage ref={stageRef} width={width} height={height} scaleX={scale} scaleY={scale} onWheel={handleWheel} style={style}
      draggable x={stagePos.x} y={stagePos.y} onDragEnd={handleDragEndGrid}>
        
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
              onSelect={() => handleUnitClick(unit)}
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
              <Text width={ghostUnit.width} height={ghostUnit.height} align="center" verticalAlign="middle" text={ghostUnit.name} fontSize={12} fill="white" opacity={0.7}/>
            </Group>
          )}
        </Layer>

      </Stage>
    </div>
  );
}