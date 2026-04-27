import { useRef, useState, useEffect, forwardRef } from "react";
import { COLOURS } from "../Colours";

// use forwardRef so FloorMapPage can pass ref in
const Canvas = forwardRef(function Canvas({ style }, ref) {
  const internalRef = useRef(null);
  // fall back on internal if forward ref not provided
  const canvasRef = ref || internalRef;

  const [width, setWidth] = useState(500);
  const [height, setHeight] = useState(500);
  const [gridSize, setGridSize] = useState(20);

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

export function FloorMapPage() {
  const canvasRef = useRef(null);

  // HTML
  return (
    <div
      // center canvas
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        overflow: "auto", // allow scrolling if canvas is too big
      }}
    >
      <Canvas
        ref={canvasRef}
        style={{
          width: "${width}px",
          height: "${height}px",
          border: "2px solid #999",
        }}
      />
    </div>
  );
}