import { useState } from "react"; 
import { COLOURS } from "./FloorMapStyles";
import { CANVAS_CONFIG } from "./Canvas";

/**
 * Toolbar component for selecting tools and adjusting floor dimensions.
 *
 * @param {string} activeTool - Currently selected tool
 * @param {(tool: string) => void} setActiveTool - State setter for updating the active tool
 * @param {{ width: number, height: number }} floorSize - Floor dimensions in pixels
 * @param {(updater: Function) => void} setFloorSize - State setter for updating floor dimensions
 * @param {() => void} onOpenCanvasSettings - Callback to open canvas settings modal
 *
 * @returns {JSX.Element} Toolbar UI element
 */
export function CanvasToolbar({ activeTool, setActiveTool, floorSize, setFloorSize, onOpenCanvasSettings }) {
    // store input seperately from pixels to avoid crash
    const [inputMeters, setInputMeters] = useState({
      width: floorSize.width / CANVAS_CONFIG.PIXELS_PER_METER,
      height: floorSize.height /  CANVAS_CONFIG.PIXELS_PER_METER,
    });

    // floor dimension validation
    const updateDimension = (dimensionType, rawValue) => {
      setInputMeters(prev => ({ ...prev, [dimensionType]: rawValue}));
      const val = Number(rawValue);
      if (rawValue === "" || Number.isNaN(val) || val <=0) return;
      setFloorSize(prev => ({...prev, [dimensionType]: val*CANVAS_CONFIG.PIXELS_PER_METER}));      
    };

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
          <button onClick={onOpenCanvasSettings}>Canvas Settings</button>
        </div>
  
      </div>
    );
}