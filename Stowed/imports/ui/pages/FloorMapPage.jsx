import { useState} from "react";
import { Canvas } from "./floorMapComponents/Canvas";
import { CanvasToolbar } from "./floorMapComponents/CanvasToolbar";
import { StoragePanel } from "./floorMapComponents/StoragePanel";

// --- TOOL OPTIONS ---
const TOOLS = {
  SELECT : "select",
  MOVE : "move",
  ADD : "add",
  DELETE : "delete"
};

/**
 * Main container component for the floor map editor page.
 * Coordinates the overall map editor state and layout including:
 * - Managing tool bar aswell as active tool
 * - Floor dimensions
 * - Storage unit placement
 * - General communication between toolbar, storage panel and canvas
 * 
 * @returns {JSX.Element} Floor map editor page layout 
 */
export function FloorMapPage() {
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize] = useState({ width: 500, height: 500 });
  
  // units live here so both the panel and canvas can access
  const [units, setUnits] = useState([]);
  // unit template the user has selected from the library panel to place
  const [pendingUnit, setPendingUnit] = useState({width: 500, height: 500})

  // --- PLACING ---
  function handlePlaceUnit(template) {
    // clicking a panel arms the add tool with that template
    setPendingUnit(template);
    setActiveTool(TOOLS.ADD);
  }

  function handleUnitPlaced() {
    // after placing, go back to select so user does not keep adding
    setPendingUnit(null);
    setActiveTool(TOOLS.SELECT)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      
      {/* CANVAS TOOLBAR - top side*/}
      <CanvasToolbar activeTool={activeTool} setActiveTool={setActiveTool} floorSize={floorSize} setFloorSize={setFloorSize}/>

      {/* MAIN ROW */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden"}}>

        {/* STORAGE PANEL - left side */}
        <StoragePanel onSelectUnit={handlePlaceUnit}/>

        {/* CANVAS AREA - takes remaining space and centers*/}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto" }}>
          <Canvas floorSize={floorSize} style={{ display: "block", width: `${floorSize.width}px`, height: `${floorSize.height}px`, border: "2px solid #999"}}/>
        </div>
      </div>
    </div>
  );}
