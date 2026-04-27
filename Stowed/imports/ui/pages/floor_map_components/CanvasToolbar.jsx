import { useState } from "react"; 
import { COLOURS } from "../../Colours";
import { CANVAS_CONFIG } from "./Canvas";

export function CanvasToolbar({ activeTool, setActiveTool, floorSize, setFloorSize }) {
    // store input seperately from pixels to avoid crash
    const [inputMeters, setInputMeters] = useState({
      width: floorSize.width / CANVAS_CONFIG.PIXELS_PER_METER,
      height: floorSize.height /  CANVAS_CONFIG.PIXELS_PER_METER,
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
              setFloorSize(prev => ({ ...prev, width: val *  CANVAS_CONFIG.PIXELS_PER_METER }));
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
              setFloorSize(prev => ({ ...prev, height: val *  CANVAS_CONFIG.PIXELS_PER_METER }));
            }}
            placeholder="Height (m)"
            style={{ width: "55px" }}
          />
          <span style={{ fontSize: 11, color: "#888" }}>m</span>
        </div>
  
      </div>
    );
  }
  