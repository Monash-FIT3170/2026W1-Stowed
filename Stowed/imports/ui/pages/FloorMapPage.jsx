import { useRef, useState} from "react";
import { Canvas, CANVAS_CONFIG } from "./floor_map_components/Canvas";
import { CanvasLabels } from "./floor_map_components/CanvasLabels";
import { CanvasToolbar } from "./floor_map_components/CanvasToolbar";

// --- CONSTANTS ---
const TOOLS = {
  SELECT : "select",
  MOVE : "move",
  ADD : "add",
  DELETE : "delete"
};

export function FloorMapPage() {
  const canvasRef = useRef(null);
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize] = useState({ width: 1000, height: 1000 });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      <CanvasToolbar
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
            <CanvasLabels width={floorSize.width} height={floorSize.height} gridSize={CANVAS_CONFIG.GRID_SIZE}/>
          </div>

        </div>
      </div>
    </div>
  );
}