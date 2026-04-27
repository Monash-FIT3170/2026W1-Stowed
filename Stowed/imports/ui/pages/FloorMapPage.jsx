import { useRef, useState} from "react";
import { Canvas } from "./floor_map_components/Canvas";
import { CanvasToolbar } from "./floor_map_components/CanvasToolbar";

// --- CONSTANTS ---
const TOOLS = {
  SELECT : "select",
  MOVE : "move",
  ADD : "add",
  DELETE : "delete"
};

export function FloorMapPage() {
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize] = useState({ width: 500, height: 500 });

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
            floorSize={floorSize}
            style={{
              display: "block",
              width: `${floorSize.width}px`,
              height: `${floorSize.height}px`,
              border: "2px solid #999",
            }}
          />

        </div>
      </div>
    </div>
  );
}