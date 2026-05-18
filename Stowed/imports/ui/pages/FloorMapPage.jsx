import { EditorProvider, useEditor } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas }               from "./floorMapComponents/canvas/components/Canvas";
import { CanvasToolbar }        from "./floorMapComponents/CanvasToolbar";
import { StoragePanel }         from "./floorMapComponents/StoragePanel";
import { CanvasSettingsModal }  from "./floorMapComponents/CanvasSettingsModal";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

/**
 * Inner layout component. Consumes EditorContext - no local state.
 */
function FloorMapPageInner() {
  const {
    activeTool, setActiveTool,
    floorSize,
    canvasSettings,
    isCanvasSettingsOpen, setCanvasSettingsOpen,
    isCanvasEditMode, setCanvasEditMode,
    units, commitUnits,
    canUndo, canRedo,
    handleUndo, handleRedo,
    handleSaveLayout, handleLoadLayout,
    handlePlaceUnit, handleUnitPlaced,
    handleCanvasSettingsSave,
  } = useEditor();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      {/* CANVAS TOOLBAR */}
      {isCanvasEditMode && (
      <CanvasToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        floorSize={floorSize}
        onSaveLayout={handleSaveLayout}
        onLoadLayout={handleLoadLayout}
        onOpenCanvasSettings={() => setCanvasSettingsOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      )}

      {/* MAIN ROW */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* STORAGE PANEL */}
        {isCanvasEditMode && 
         ( <StoragePanel onSelectUnit={handlePlaceUnit} />
        )}

        {/* CANVAS AREA */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto" }}>
          <Canvas
            style={{
              display: "block",
              width:   "100%",
              height:  "100%",
            }}

            isCanvasEditMode = {isCanvasEditMode}
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

      <button
        onClick={() =>setCanvasEditMode(!isCanvasEditMode)}
        style = {{
          position : "fixed",
          bottom : 20,
          right: 20,
          borderRadius: "8px",
          background: "black",
          color: "white",
          padding: "12px",
          zIndex: 1000
        }}
        >
        { isCanvasEditMode ? "Toggle View" : "Toggle Edit" }
      </button>
    </div>


  );
}

/**
 * Main container for the floor map editor.
 * Wraps the layout in EditorProvider so all descendants can access editor state.
 */
export function FloorMapPage() {
  return (
    <EditorProvider>
      <FloorMapPageInner />
    </EditorProvider>
  );
}