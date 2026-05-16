import { EditorProvider, useEditor } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas }               from "./floorMapComponents/canvas/components/Canvas";
import { CanvasToolbar }        from "./floorMapComponents/CanvasToolbar";
import { StoragePanel }         from "./floorMapComponents/StoragePanel";
import { CanvasSettingsModal }  from "./floorMapComponents/CanvasSettingsModal";
import { buttonStyles, pageStyles } from "./floorMapComponents/FloorMapStyles";
import { useParams } from "react-router-dom";

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
    <div style={pageStyles.page}>
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
      <div style={pageStyles.mainRow}>
        {/* STORAGE PANEL */}
        {isCanvasEditMode && 
         ( <StoragePanel onSelectUnit={handlePlaceUnit} />
        )}

        {/* CANVAS AREA */}
        <div style={pageStyles.canvasShell}>
          <div style={pageStyles.canvasInner}>
            <Canvas
              style={{
                display: "block",
                width: "100%",
                height: "100%",
              }}
              isCanvasEditMode={isCanvasEditMode}
            />
          </div>
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
        onClick={() => setCanvasEditMode(!isCanvasEditMode)}
        style={{
          ...buttonStyles.base,
          ...(isCanvasEditMode ? buttonStyles.secondary : buttonStyles.primary),
          ...pageStyles.floatingButton,
          padding: "10px 18px",
        }}
      >
        {isCanvasEditMode ? "Exit Edit Mode" : "Edit Floor Map"}
      </button>
    </div>


  );
}

/**
 * Main container for the floor map editor.
 * Wraps the layout in EditorProvider so all descendants can access editor state.
 */
export function FloorMapPage() {
  const { floorMapId } = useParams();

  return (
    <EditorProvider floorMapId={floorMapId}>
      <FloorMapPageInner />
    </EditorProvider>
  );
}