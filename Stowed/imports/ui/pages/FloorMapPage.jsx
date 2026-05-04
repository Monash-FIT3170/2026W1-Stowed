import { useState} from "react";
import { Canvas } from "./floorMapComponents/Canvas";
import { CanvasToolbar } from "./floorMapComponents/CanvasToolbar";
import { StoragePanel } from "./floorMapComponents/StoragePanel";
import { CanvasSettingsModal } from "./floorMapComponents/CanvasSettingsModal";
import { CANVAS_CONFIG } from "./floorMapComponents/Canvas";

// --- TOOL OPTIONS ---
const TOOLS = {
  SELECT : "select",
  MOVE : "move",
  ADD : "add",
  DELETE : "delete"
};

// --- DEFAULT CANVAS CONFIG ---
// DEFAULT_CANVAS_SETTINGS stored here as it is a mutable user state
// CANVAS_CONFIG holds compile time constants
const DEFAULT_CANVAS_SETTINGS = {
  gridInterval: CANVAS_CONFIG.METERS_PER_CELL,
  showGrid:     true,
  snapToGrid:   true,
}; 

/**
 * Main container component for the floor map editor page.
 * Coordinates the overall map editor state and layout including:
 * - Managing tool bar and active tool
 * - Floor dimensions and canvas config
 * - Storage unit placement
 * - General communication between toolbar, storage panel, canvas and canvas settings
 * 
 * @returns {JSX.Element} Floor map editor page layout 
 */
export function FloorMapPage() {
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);

  // --- CANVAS CONFIG STATE ---
  const [floorSize, setFloorSize] = useState({ width: 500, height: 500 });
  const [canvasSettings, setCanvasSettings] = useState(DEFAULT_CANVAS_SETTINGS);
  const [isCanvasSettingsOpen, setCanvasSettingsOpen] = useState(false);

  // --- UNIT STATE ---
  const [units, setUnits] = useState([]);
  const [pendingUnit, setPendingUnit] = useState(null);

    function handleSaveLayout() {
      const layout = {
        floorSize,
        units,
      };

      localStorage.setItem("floorMapLayout", JSON.stringify(layout));
      alert("Layout saved successfully!");
    }

    function handleLoadLayout() {
      const savedLayout = localStorage.getItem("floorMapLayout");

      if (!savedLayout) {
        alert("No saved layout found.");
        return;
      }

      const layout = JSON.parse(savedLayout);

      setFloorSize(layout.floorSize);
      setUnits(layout.units);
      alert("Layout loaded successfully!");
    }
  // --- PLACING ---
  function handlePlaceUnit(template) {
    // clicking a panel arms the add tool with that template
    setPendingUnit(template);
    setActiveTool(TOOLS.ADD);
  }

  function handleUnitPlaced() {
    // after placing, go back to select so user does not keep adding
    setPendingUnit(null);
    setActiveTool(TOOLS.SELECT);
  }

  // --- CANVAS SETTINGS ---
  function handleCanvasSettingsSave({ floorSize: newFloorSize, gridInterval, showGrid, snapToGrid }) {
    setFloorSize(newFloorSize);
    setCanvasSettings({ gridInterval, showGrid, snapToGrid });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      
      {/* CANVAS TOOLBAR - top side*/}
      <CanvasToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        floorSize={floorSize}
        setFloorSize={setFloorSize}
        onSaveLayout={handleSaveLayout}
        onLoadLayout={handleLoadLayout}
        onOpenCanvasSettings={() => setCanvasSettingsOpen(true)}
      />

      {/* MAIN ROW */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden"}}>

        {/* STORAGE PANEL - left side */}
        <StoragePanel onSelectUnit={handlePlaceUnit}/>

        {/* CANVAS AREA - takes remaining space and centers*/}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto" }}>
          <Canvas
            floorSize={floorSize}
            activeTool={activeTool}
            units={units}
            setUnits={setUnits}
            pendingUnit={pendingUnit}
            onUnitPlaced={handleUnitPlaced}
            style={{
              display: "block",
              width: `${floorSize.width}px`,
              height: `${floorSize.height}px`,
              border: "2px solid #999"
            }}
            canvasSettings={canvasSettings}
            style={{ display: "block", width: `${floorSize.width}px`, height: `${floorSize.height}px`, border: "2px solid #999" }}
          />
        </div>
      </div>

      {/* CANVAS SETTINGS MODAL */}
      {isCanvasSettingsOpen && (
        <CanvasSettingsModal
          floorSize={floorSize}
          gridInterval={canvasSettings.gridInterval}
          showGrid={canvasSettings.showGrid}
          snapToGrid={canvasSettings.snapToGrid}
          onSave={handleCanvasSettingsSave}
          onClose={() => setCanvasSettingsOpen(false)}
        />
      )}
    </div>
  );
}