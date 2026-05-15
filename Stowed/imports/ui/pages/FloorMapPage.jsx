import { useState } from "react";
import { EditorProvider, useEditor } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas }               from "./floorMapComponents/canvas/components/Canvas";
import { CanvasToolbar }        from "./floorMapComponents/CanvasToolbar";
import { StoragePanel }         from "./floorMapComponents/StoragePanel";
import { CanvasSettingsModal }  from "./floorMapComponents/CanvasSettingsModal";
import { useParams }            from "react-router-dom";
import "./FloorMapPage.css";

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
    units,
    canUndo, canRedo,
    handleUndo, handleRedo,
    handleSaveLayout, handleLoadLayout,
    handlePlaceUnit,
    handleCanvasSettingsSave,
    selectedUnit, setIsPanelOpen, isPanelOpen,
    lowStockByUnitId,
  } = useEditor();

  const [tooltip, setTooltip] = useState(null);

  const items = selectedUnit ? (lowStockByUnitId?.[selectedUnit?._id] ?? []) : [];
  const lowItems = items.filter((i) => i.isLow);
  const okItems  = items.filter((i) => !i.isLow);
  const hasLow   = lowItems.length > 0;

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
        {isCanvasEditMode && (
          <StoragePanel onSelectUnit={handlePlaceUnit} />
        )}

        {/* CANVAS AREA */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto" }}>
          <Canvas
            style={{ display: "block", width: "100%", height: "100%" }}
            isCanvasEditMode={isCanvasEditMode}
            onUnitHover={({ unit, items, x, y }) => setTooltip({ unit, items, x, y })}
            onUnitHoverEnd={() => setTooltip(null)}
          />
        </div>

        {/* SLIDE-OUT PANEL */}
        {isPanelOpen && selectedUnit && (
          <div className="low-stock-panel">

            {/* HEADER */}
            <div className={`panel-header ${hasLow ? "has-low" : "all-ok"}`}>
              <div>
                <div className="panel-header-label">Storage Unit</div>
                <div className="panel-header-title">{selectedUnit.name}</div>
                <span className={`panel-status-badge ${hasLow ? "low" : "ok"}`}>
                  {hasLow ? `⚠ ${lowItems.length} low stock` : "✓ All in stock"}
                </span>
              </div>
              <button className="panel-close-btn" onClick={() => setIsPanelOpen(false)}>
                ✕
              </button>
            </div>

            {/* CONTENT */}
            <div className="panel-content">
              {items.length === 0 ? (
                <div className="panel-empty">No products assigned to this unit.</div>
              ) : (
                <>
                  {/* LOW STOCK */}
                  {lowItems.length > 0 && (
                    <div className="panel-section">
                      <div className="panel-section-title low">Low Stock</div>
                      {lowItems.map((item, i) => (
                        <div key={i} className="panel-item low">
                          <div>
                            <div className="panel-item-name">{item.product.name}</div>
                            <div className="panel-item-location">{item.locationName}</div>
                          </div>
                          <div>
                            <div className="panel-item-qty low">{item.quantity}</div>
                            <div className="panel-item-threshold">min {item.threshold}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* IN STOCK */}
                  {okItems.length > 0 && (
                    <div className="panel-section">
                      <div className="panel-section-title ok">In Stock</div>
                      {okItems.map((item, i) => (
                        <div key={i} className="panel-item ok">
                          <div>
                            <div className="panel-item-name">{item.product.name}</div>
                            <div className="panel-item-location">{item.locationName}</div>
                          </div>
                          <div>
                            <div className="panel-item-qty ok">{item.quantity}</div>
                            <div className="panel-item-threshold">min {item.threshold}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        )}

      </div>

      {/* HOVER TOOLTIP */}
      {tooltip && (() => {
        const tipItems  = tooltip.items ?? [];
        const tipLow    = tipItems.filter((i) => i.isLow);
        const tipHasLow = tipLow.length > 0;

        return (
          <div style={{
            position:      "fixed",
            left:          tooltip.x,
            top:           tooltip.y,
            background:    "white",
            border:        `1px solid ${tipHasLow ? "#fca5a5" : tipItems.length === 0 ? "#d9cfc0" : "#86efac"}`,
            borderRadius:  "8px",
            padding:       "10px 14px",
            minWidth:      "160px",
            maxWidth:      "240px",
            boxShadow:     "0 4px 12px rgba(0,0,0,0.12)",
            fontSize:      "12px",
            fontFamily:    "Inter, sans-serif",
            color:         "#1a1a1a",
            pointerEvents: "none",
            zIndex:        200,
          }}>
            <div style={{
              fontWeight:   700,
              marginBottom: "6px",
              color: tipItems.length === 0 ? "#998874" : tipHasLow ? "#991b1b" : "#166534",
            }}>
              {tooltip.unit.name}
            </div>

            {tipItems.length === 0 ? (
              <div style={{ color: "#998874", fontSize: "11px" }}>
                No items on this shelf
              </div>
            ) : tipHasLow ? (
              <>
                <div style={{ fontSize: "11px", color: "#991b1b", marginBottom: "4px", fontWeight: 600 }}>
                  Low stock items:
                </div>
                {tipLow.map((item, i) => (
                  <div key={i} style={{
                    display:       "flex",
                    flexDirection: "column",
                    padding:       "4px 0",
                    borderBottom:  "0.5px solid #f5efe6",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600 }}>{item.product.name}</span>
                      <span style={{ color: "#991b1b", fontWeight: 600, marginLeft: "8px" }}>
                        {item.quantity} left
                      </span>
                    </div>
                    <span style={{ fontSize: "10px", color: "#998874" }}>{item.locationName}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: "#166534", fontSize: "11px" }}>
                All items on this shelf are stocked
              </div>
            )}
          </div>
        );
      })()}

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
          position:     "fixed",
          bottom:       20,
          right:        20,
          borderRadius: "8px",
          background:   "black",
          color:        "white",
          padding:      "12px",
          zIndex:       1000,
        }}
      >
        {isCanvasEditMode ? "Toggle View" : "Toggle Edit"}
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