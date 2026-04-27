import { useRef, useState, useEffect, forwardRef } from "react";
import { COLOURS } from "../Colours";

// --- CONSTANTS ---
const METERS_PER_CELL = 1;
const PIXELS_PER_METER = 50;
const GRID_SIZE = PIXELS_PER_METER * METERS_PER_CELL;

const TOOLS = {
  SELECT : "select",
  MOVE : "move",
  ADD : "add",
  DELETE : "delete"
};

// --- CANVAS ---
// use forwardRef so FloorMapPage can pass ref in
const Canvas = forwardRef(function Canvas({ style, floorSize }, ref) {

  // fallback on internal ref if forward ref fails
  const canvasRef = ref || useRef(null);

  const width = floorSize.width;
  const height = floorSize.height;
  const gridSize = PIXELS_PER_METER * METERS_PER_CELL;

  useEffect(() => {
    // get canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // redraw
    ctx.clearRect(0, 0, width, height);

    // background
    ctx.fillStyle = COLOURS.CANVAS_FILL;
    ctx.fillRect(0, 0, width, height);

    // draw grid
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [width, height, gridSize]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={style}
    />
  );
});

// --- GRID LABELS ---
function CLabels({width, height, gridSize}) {
  /**
   * Adds grid labels to canvas
   */
  const labels = [];

  for (let i=0; i<=width; i+=gridSize) {
    labels.push(
      <div
        key={`x-${i}`}
        style={{
          position: "absolute",
          left: i,
          top: -20,
          fontSize: 10,
          color: COLOURS.CANVAS_LABEL,
        }}
      >
        {i / gridSize}m
      </div>
    );
  }

  for (let j=0; j<=height; j+=gridSize) {
    labels.push(
      <div
        key={`y-${j}`}
        style={{
          position: "absolute",
          left: -25,
          top: j,
          fontSize: 10,
          color: COLOURS.CANVAS_LABEL,
        }}
      >
        {j / gridSize}m
      </div>
    );
  }

  return <>{labels}</>; 
}

// --- TOOLS ---
function Toolbar({ activeTool, setActiveTool, floorSize, setFloorSize }) {
  // store input seperately from pixels to avoid crash
  const [inputMeters, setInputMeters] = useState({
    width: floorSize.width / PIXELS_PER_METER,
    height: floorSize.height / PIXELS_PER_METER,
  });

  return (
    <div style={{
      display: "flex",
      gap: "10px",
      padding: "10px",
      background: COLOURS.TOOL_BAR_COLOUR,
      borderBottom: "1px solid #ccc",
    }}>

      {/* TOOLS */}
      <button onClick={() => setActiveTool("select")}>Select</button>
      <button onClick={() => setActiveTool("move")}>Move</button>
      <button onClick={() => setActiveTool("add")}>Add</button>
      <button onClick={() => setActiveTool("delete")}>Delete</button>

      <div style={{ marginLeft: "20px" }}>Active Tool: <b>{activeTool}</b></div>

      {/* FLOOR SIZE CONTROLS */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
        <input
          type="number"
          value={inputMeters.width}
          onChange={(e) => {
            const val = Number(e.target.value);
            // update display value in meters
            setInputMeters(prev => ({ ...prev, width: val }));
            // store as pixels in floorSize
            setFloorSize(prev => ({ ...prev, width: val * PIXELS_PER_METER }));
          }}
          placeholder="Width (m)"
          style={{ width: "55px" }}
        />
        x
        <input
          type="number"
          value={inputMeters.height}
          onChange={(e) => {
            const val = Number(e.target.value);
            // update display value in meters
            setInputMeters(prev => ({ ...prev, height: val }));
            // store as pixels in floorSize
            setFloorSize(prev => ({ ...prev, height: val * PIXELS_PER_METER }));
          }}
          placeholder="Height (m)"
          style={{ width: "55px" }}
        />
        <span style={{ fontSize: 11, color: "#888" }}>m</span>
      </div>

    </div>
  );
}

export function FloorMapPage() {
  const canvasRef = useRef(null);
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize] = useState({ width: 1000, height: 1000 });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        floorSize={floorSize}
        setFloorSize={setFloorSize}
      />

      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto" }}>
        <div style={{ position: "relative" }}>

          <Canvas
            ref={canvasRef}
            floorSize={floorSize}
            style={{
              display: "block",
              width: `${floorSize.width}px`,
              height: `${floorSize.height}px`,
              border: "2px solid #999",
            }}
          />

          <div style={{ position: "absolute", top: 0, left: 0, zIndex: 10, overflow: "visible" }}>
            <CLabels width={floorSize.width} height={floorSize.height} gridSize={GRID_SIZE} />
          </div>

        </div>
      </div>
    </div>
  );
}