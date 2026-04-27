import { useRef, useState, useEffect, forwardRef } from "react";
import { COLOURS } from "../Colours";

const METERS_PER_CELL = 1;
const PIXELS_PER_METER = 50;
// test
const TEST_WIDTH = 500;
const TEST_HEIGHT = 500;
const GRID_SIZE = PIXELS_PER_METER * METERS_PER_CELL;


// use forwardRef so FloorMapPage can pass ref in
const Canvas = forwardRef(function Canvas({ style }, ref) {
  const internalRef = useRef(null);
  // fall back on internal if forward ref not provided
  const canvasRef = ref || internalRef;

  const [width, setWidth] = useState(TEST_WIDTH);
  const [height, setHeight] = useState(TEST_HEIGHT);
  const gridSize = PIXELS_PER_METER * METERS_PER_CELL;

  useEffect(() => {
    // extract canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // redraw
    ctx.clearRect(0, 0, width, height);

    // background
    ctx.fillStyle = COLOURS.CANVAS_FILL;
    ctx.fillRect(0, 0, width, height);

    // grid lines
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

  // HTML
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={style}
    />
  );
});

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

export function FloorMapPage() {
  const canvasRef = useRef(null);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        overflow: "auto",
      }}
    >

      <div style={{ position: "relative" }}>
        <Canvas
          ref={canvasRef}
          style={{
            width: `${TEST_WIDTH}px`,
            height: `${TEST_HEIGHT}px`,
            border: "2px solid #999",
          }}
        />

        <div style={{ position: "absolute", top: 0, left: 0, zIndex: 10 }}>
          <CLabels width={TEST_WIDTH} height={TEST_HEIGHT} gridSize={GRID_SIZE} />
        </div>

      </div>
    </div>
  );
}