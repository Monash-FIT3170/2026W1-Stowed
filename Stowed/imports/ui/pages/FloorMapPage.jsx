import { useState } from "react";
import { EditorProvider, useEditor } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { CanvasToolbar } from "./floorMapComponents/CanvasToolbar";
import { StoragePanel } from "./floorMapComponents/StoragePanel";
import { CanvasSettingsModal } from "./floorMapComponents/CanvasSettingsModal";
import { buttonStyles, pageStyles } from "./floorMapComponents/FloorMapStyles";
import { useParams } from "react-router-dom";
import { StorageLocationPanel } from "./floorMapComponents/StorageLocationPanel";
import "../Global.css";
import "./FloorMapPage.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) { reject(error); return; }
      resolve(result);
    });
  });
}

function FloorMapPageInner() {
  const {
    activeTool, setActiveTool,
    floorSize, canvasSettings,
    isCanvasSettingsOpen, setCanvasSettingsOpen,
    isCanvasEditMode, setCanvasEditMode,
    units, commitUnits,
    canUndo, canRedo, handleUndo, handleRedo,
    handleSaveLayout, handleLoadLayout,
    handlePlaceUnit, handleUnitPlaced,
    handleCanvasSettingsSave,
    selectedUnit, setIsPanelOpen, isPanelOpen,
    lowStockByUnitId,
  } = useEditor();

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [isStockPanelOpen, setIsStockPanelOpen] = useState(false);

  const items    = selectedUnit?.mockItems ?? (lowStockByUnitId?.[selectedUnit?._id] ?? []);
  const lowItems = items.filter((i) => i.isLow);
  const okItems  = items.filter((i) => !i.isLow);
  const hasLow   = lowItems.length > 0;
  const isEmpty  = items.length === 0;

  const handleUnitSelect = (unitId) => {
    setSelectedStorageUnitId(unitId);
    setIsStockPanelOpen(!!unitId);
  };

  return (
    <div className="item-detail-container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div className="item-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-link">Floor Map</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">
            {isCanvasEditMode ? "Edit mode" : "View mode"}
          </span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Floor <em>Map</em></h1>
        </div>
      </div>

      {/* ── Map row ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* CANVAS */}
        <div style={{ ...pageStyles.canvasArea, flex: 1 }}>
          <Canvas
            style={{ display: "block", width: "100%", height: "100%" }}
            isCanvasEditMode={isCanvasEditMode}
            selectedStorageUnitId={selectedStorageUnitId}
            setSelectedStorageUnitId={handleUnitSelect}
          />
        </div>

        {/* STOCK SLIDE-OUT PANEL — shown in both modes when a unit is selected */}
        {selectedUnit && isStockPanelOpen && (
          <div className="low-stock-panel">
            <div className={`panel-header ${isEmpty ? "no-items" : hasLow ? "has-low" : "all-ok"}`}>
              <div>
                <div className="panel-header-label">{selectedUnit.name}</div>
                <div className="panel-header-title">
                  {isEmpty ? "No items" : hasLow ? "Low stock" : "All stocked"}
                </div>
                <div className={`panel-status-badge ${isEmpty ? "empty" : hasLow ? "low" : "ok"}`}>
                  {isEmpty
                    ? "Empty"
                    : hasLow
                    ? `${lowItems.length} need attention`
                    : `${okItems.length} items OK`}
                </div>
              </div>
              <button
                className="panel-close-btn"
                onClick={() => setIsStockPanelOpen(false)}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            <div className="panel-content">
              {isEmpty ? (
                <div className="panel-empty">No items assigned to this unit.</div>
              ) : (
                <>
                  {lowItems.length > 0 && (
                    <div className="panel-section">
                      <div className="panel-section-title low">Low stock</div>
                      {lowItems.map((item, i) => (
                        <div key={i} className="panel-item low">
                          <div>
                            <div className="panel-item-name">{item.product?.name ?? item.name}</div>
                            <div className="panel-item-location">{item.locationName}</div>
                          </div>
                          <div>
                            <div className="panel-item-qty low">{item.quantity}</div>
                            <div className="panel-item-threshold">min {item.reorderAt}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {okItems.length > 0 && (
                    <div className="panel-section">
                      <div className="panel-section-title ok">In stock</div>
                      {okItems.map((item, i) => (
                        <div key={i} className="panel-item ok">
                          <div>
                            <div className="panel-item-name">{item.product?.name ?? item.name}</div>
                            <div className="panel-item-location">{item.locationName}</div>
                          </div>
                          <div>
                            <div className="panel-item-qty ok">{item.quantity}</div>
                            <div className="panel-item-threshold">min {item.reorderAt}</div>
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

        {/* EDIT MODE SIDEBAR */}
        {isCanvasEditMode && (
          <div
            style={{
              ...pageStyles.sidebarBase,
              ...pageStyles.sidebarRight,
              ...(isSidebarOpen ? pageStyles.sidebarOpen : pageStyles.sidebarCollapsed),
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
                    style={{ ...buttonStyles.base, ...buttonStyles.secondary, width: "100%" }}
                  >
                    Exit Edit Mode
                  </button>
                </div>
              </>
            )}
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
            position: "fixed", left: tooltip.x, top: tooltip.y,
            background: "white",
            border: `1px solid ${tipHasLow ? "#fca5a5" : tipItems.length === 0 ? "#d9cfc0" : "#86efac"}`,
            borderRadius: "8px", padding: "10px 14px",
            minWidth: "160px", maxWidth: "240px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            fontSize: "12px", fontFamily: "Inter, sans-serif",
            color: "#1a1a1a", pointerEvents: "none", zIndex: 200,
          }}>
            <div style={{ fontWeight: 700, marginBottom: "6px",
              color: tipItems.length === 0 ? "#998874" : tipHasLow ? "#991b1b" : "#166534" }}>
              {tooltip.unit.name}
            </div>
            {tipItems.length === 0 ? (
              <div style={{ color: "#998874", fontSize: "11px" }}>No items on this shelf</div>
            ) : tipHasLow ? (
              <>
                <div style={{ fontSize: "11px", color: "#991b1b", marginBottom: "4px", fontWeight: 600 }}>
                  Low stock items:
                </div>
                {tipLow.map((item, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column",
                    padding: "4px 0", borderBottom: "0.5px solid #f5efe6" }}>
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
              <div style={{ color: "#166534", fontSize: "11px" }}>All items on this shelf are stocked</div>
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

      {/* FLOATING EDIT BUTTON — view mode only */}
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

export function FloorMapPage() {
  const { floorMapId } = useParams();
  return (
    <EditorProvider floorMapId={floorMapId}>
      <FloorMapPageInner />
    </EditorProvider>
  );
}