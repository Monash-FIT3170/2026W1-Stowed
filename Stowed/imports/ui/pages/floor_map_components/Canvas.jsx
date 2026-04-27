import { useRef, forwardRef, useEffect } from "react";
import { COLOURS } from "../../Colours";

export const CANVAS_CONFIG = {
  METERS_PER_CELL : 1,
  PIXELS_PER_METER : 50,
  GRID_SIZE : 50 * 1
}

// use forwardRef so FloorMapPage can pass ref 
export const Canvas = forwardRef(function Canvas({ style, floorSize }, ref) {

    // fallback on internal ref if forward ref fails
    const canvasRef = ref || useRef(null);
  
    const width = floorSize.width;
    const height = floorSize.height;
    const gridSize = CANVAS_CONFIG.GRID_SIZE;
  
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
  