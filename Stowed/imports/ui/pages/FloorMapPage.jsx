import { useState } from "react";
import {
  EditorProvider,
  useEditor,
} from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { CanvasToolbar } from "./floorMapComponents/CanvasToolbar";
import { StoragePanel } from "./floorMapComponents/StoragePanel";
import { CanvasSettingsModal } from "./floorMapComponents/CanvasSettingsModal";
import { buttonStyles, pageStyles } from "./floorMapComponents/FloorMapStyles";
import { useParams } from "react-router-dom";
import { StorageLocationPanel } from "./floorMapComponents/StorageLocationPanel";

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
    activeTool,
    setActiveTool,
    floorSize,
    canvasSettings,
    isCanvasSettingsOpen,
    setCanvasSettingsOpen,
    isCanvasEditMode,
    setCanvasEditMode,
    units,
    commitUnits,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleSaveLayout,
    handleLoadLayout,
    handlePlaceUnit,
    handleUnitPlaced,
    handleCanvasSettingsSave,
  } = useEditor();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState(null);

  return (
    <div style={pageStyles.page}>
      {/* MAIN ROW */}
      <div style={pageStyles.mainRow}>
        {/* CANVAS AREA */}
        <div style={pageStyles.canvasArea}>
          <Canvas
            style={{
              display: "block",
              width: "100%",
              height: "100%",
            }}
            isCanvasEditMode={isCanvasEditMode}
            selectedStorageUnitId={selectedStorageUnitId}
            setSelectedStorageUnitId={setSelectedStorageUnitId}
          />
        </div>

        {/* SIDEBAR */}
        {isCanvasEditMode && (
          <div
            style={{
              ...pageStyles.sidebarBase,
              ...pageStyles.sidebarRight,
              ...(isSidebarOpen
                ? pageStyles.sidebarOpen
                : pageStyles.sidebarCollapsed),
            }}
          >
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              style={pageStyles.sidebarToggle}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? "☰" : "☰"}
            </button>
            {isSidebarOpen && (
              <>
                <StoragePanel onSelectUnit={handlePlaceUnit} />

                <div style={pageStyles.sidebarDivider} />

                <StorageLocationPanel storageUnitId={selectedStorageUnitId} />

                <div style={pageStyles.sidebarDivider} />

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
                <div style={pageStyles.sidebarFooter}>
                  <button
                    onClick={() => setCanvasEditMode(false)}
                    style={{
                      ...buttonStyles.base,
                      ...buttonStyles.secondary,
                      width: "100%",
                    }}
                  >
                    Exit Edit Mode
                  </button>
                </div>
              </>
            )}
          </div>
        )}
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
          position: "fixed",
          bottom: 20,
          right: 20,
          borderRadius: "8px",
          background: "black",
          color: "white",
          padding: "12px",
          zIndex: 1000,
        }}
      >
        {isCanvasEditMode ? "Toggle View" : "Toggle Edit"}
      </button>
      {!isCanvasEditMode && (
        <button
          onClick={() => setCanvasEditMode(true)}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.primary,
            ...pageStyles.floatingButton,
            padding: "10px 18px",
          }}
        >
          Edit Floor Map
        </button>
      )}
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
