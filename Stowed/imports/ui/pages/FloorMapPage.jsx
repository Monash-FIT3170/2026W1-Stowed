import { useState } from "react";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { EditorProvider, useEditor } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { CanvasToolbar } from "./floorMapComponents/CanvasToolbar";
import { StoragePanel } from "./floorMapComponents/StoragePanel";
import { CanvasSettingsModal } from "./floorMapComponents/CanvasSettingsModal";
import { pageStyles, COLOURS } from "./floorMapComponents/FloorMapStyles";
import { useParams, useNavigate } from "react-router-dom";
import { StorageLocationPanel } from "./floorMapComponents/StorageLocationPanel";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { FloorMaps, Sites, MapShapes, } from "/imports/api/locations/collections";
import "../Global.css";
import "./FloorMapPage.css";
import { CreateShapeModal } from "./floorMapComponents/CreateShapeModal";
import { UnitCard } from "./floorMapComponents/UnitCard";
import { CustomShapesPanel } from "./floorMapComponents/CustomShapesPanel";
import { buttonStyles } from "./floorMapComponents/FloorMapStyles";

function FloorMapPageInner() {
  const { role } = useAuth();
  const canManage = hasClientPermission(role, "locations.manage");

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
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleSaveLayout,
    handleLoadLayout,
    handleCanvasSettingsSave,
    selectedUnit,
    setSelectedUnit,
    lowStockByUnitId,
    handleDeleteSelectedUnit,
  } = useEditor();

  const { floorMapId } = useParams();
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [isStockPanelOpen, setIsStockPanelOpen] = useState(false);
  const [isCreateShapeOpen, setIsCreateShapeOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState("units"); // "units" | "templates"

  // Fetch all sites and floor maps for the tab bar
  const { sites, floorMaps, mapShapes, locationsReady } = useTracker(() => {
    const handle = Meteor.subscribe("locations.all");
    return {
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      mapShapes: MapShapes.find({}, { sort: { name: 1 } }).fetch(),
      locationsReady: handle.ready(),
    };
  }, []);

  const items = selectedUnit?.mockItems ?? (lowStockByUnitId?.[selectedUnit?._id] ?? []);
  const lowItems = items.filter((i) => i.isLow);
  const okItems = items.filter((i) => !i.isLow);
  const isEmpty = items.length === 0;
  const hasLow = lowItems.length > 0;

  const handleUnitSelect = (unitId) => {
    setSelectedStorageUnitId(unitId);
    const unit = units.find((u) => u._id === unitId || u.id === unitId) ?? null;
    setSelectedUnit(unit);
    setIsStockPanelOpen(!!unitId);
  };

  // Current floor map
  const currentFloorMap = floorMaps.find((f) => f._id === floorMapId) ?? floorMaps[0];
  const currentSite = sites.find((s) => s._id === currentFloorMap?.siteId);

  return (
    <div
      className="product-detail-container"
      style={{
        height: "100vh",
        minHeight: "unset",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* -- Slim status row - the sidebar nav already labels this page "Floor Map" -- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "10px 28px",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--card-bg)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-dark)" }}>
          {currentSite ? `${currentSite.name} - ` : ""}{currentFloorMap?.name ?? "Floor Map"}
        </span>
        <button
          type="button"
          onClick={() => canManage && setCanvasEditMode(!isCanvasEditMode)}
          disabled={!canManage}
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "4px 10px",
            borderRadius: "999px",
            border: `1px solid ${isCanvasEditMode ? "var(--accent-primary)" : "var(--border-light)"}`,
            color: isCanvasEditMode ? "var(--accent-primary)" : "var(--text-muted)",
            background: isCanvasEditMode ? "var(--accent-soft, #fde8d8)" : "var(--input-bg, #fdf7f2)",
            cursor: canManage ? "pointer" : "default",
            fontFamily: "inherit",
          }}
        >
          {isCanvasEditMode ? "Edit mode" : "View mode"}
        </button>
      </div>

      {/* -- Floor map tabs - only render once data is ready and there are multiple maps -- */}
      {locationsReady && floorMaps.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "0 28px",
            borderBottom: "1px solid var(--border-light)",
            background: "var(--card-bg)",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          {/* Group by site */}
          {sites.map((site) => {
            const siteMaps = floorMaps.filter((f) => f.siteId === site._id);
            if (!siteMaps.length) return null;
            return siteMaps.map((fm) => {
              const isActive = fm._id === (floorMapId ?? floorMaps[0]?._id);
              return (
                <button
                  key={fm._id}
                  onClick={() => navigate(`/floor-map/${fm._id}`)}
                  style={{
                    padding: "10px 16px",
                    border: "none",
                    borderBottom: isActive
                      ? "2px solid var(--accent-primary)"
                      : "2px solid transparent",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  {site.name} - {fm.name}
                </button>
              );
            });
          })}
        </div>
      )}

      {/* -- Edit mode toolbar - horizontal top bar with tools, undo/redo, layout -- */}
      {isCanvasEditMode && canManage && (
        <CanvasToolbar
          activeTool={activeTool} setActiveTool={setActiveTool}
          floorSize={floorSize}
          onSaveLayout={handleSaveLayout} onLoadLayout={handleLoadLayout}
          onOpenCanvasSettings={() => setCanvasSettingsOpen(true)}
          onUndo={handleUndo} onRedo={handleRedo}
          canUndo={canUndo} canRedo={canRedo}
        />
      )}

      {/* -- Map row -- */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* CANVAS - only render once data is ready */}
        <div
          style={{
            ...pageStyles.canvasArea,
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
            background: COLOURS.PAGE_BG,
          }}
        >
          {locationsReady && (
            <Canvas
              key={floorMapId ?? "default"}
              style={{ display: "block", width: "100%", height: "100%" }}
              isCanvasEditMode={isCanvasEditMode}
              selectedStorageUnitId={selectedStorageUnitId}
              setSelectedStorageUnitId={handleUnitSelect}
              setTooltip={setTooltip}
              lowStockByUnitId={lowStockByUnitId}
            />
          )}
        </div>

        {/* RIGHT COLUMN - stock panel + edit sidebar stacked */}
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, height: "100%", borderLeft: "1px solid var(--border-light)" }}>

          {/* STOCK SLIDE-OUT PANEL - view mode only */}
          {selectedUnit && isStockPanelOpen && !isCanvasEditMode && (
            <div className="low-stock-panel" style={{ borderLeft: "none", flex: "0 0 auto" }}>
              <div className={`panel-header ${isEmpty ? "no-items" : hasLow ? "has-low" : "all-ok"}`}>
                <div>
                  <div className="panel-header-label">{selectedUnit.name}</div>
                  <div className="panel-header-title">
                    {isEmpty ? "No products" : hasLow ? "Low stock" : "All stocked"}
                  </div>
                  <div className={`panel-status-badge ${isEmpty ? "empty" : hasLow ? "low" : "ok"}`}>
                    {isEmpty ? "Empty" : hasLow ? `${lowItems.length} need attention` : `${okItems.length} products OK`}
                  </div>
                </div>
                <button className="panel-close-btn" onClick={() => setIsStockPanelOpen(false)} aria-label="Close panel">✕</button>
              </div>
              <div className="panel-content">
                {isEmpty ? (
                  <div className="panel-empty">No products assigned to this unit.</div>
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
                              {item.reorderAt > 0 && (
                                <div className="panel-item-threshold">min {item.reorderAt}</div>
                              )}
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
                              {item.reorderAt > 0 && (
                                <div className="panel-item-threshold">min {item.reorderAt}</div>
                              )}
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

          {/* EDIT MODE SIDEBAR - only accessible to admins/owners */}
          {isCanvasEditMode && canManage && (
            <>
              {isSidebarOpen ? (
                <div style={{
                  width: "260px", minWidth: "260px", maxWidth: "260px",
                  flexShrink: 0, background: "var(--card-bg)",
                  display: "flex", flexDirection: "column",
                  overflow: "hidden", flex: 1,
                }}>
                  <div className="section-title" style={{ padding: "14px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                    {selectedUnit ? (
                      <button
                        onClick={() => handleUnitSelect(null)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "13px", padding: 0, marginRight: "8px" }}
                        aria-label="Back to list"
                      >←</button>
                    ) : null}
                    <span style={{ fontWeight: 700, color: "var(--text-dark)" }}>
                      {selectedUnit ? `Edit "${selectedUnit.name}"` : "Edit Mode"}
                    </span>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      style={{ ...pageStyles.sidebarToggle, fontSize: "11px", padding: "4px 8px", marginLeft: "auto" }}
                      aria-label="Collapse sidebar"
                    >→</button>
                  </div>

                  {/* TABS - hidden while editing a specific storage unit's settings */}
                  {!selectedUnit && (
                    <div style={{ display: "flex", gap: "4px", padding: "0 14px", flexShrink: 0, borderBottom: "1px solid var(--border-light)" }}>
                      {[
                        { key: "units", label: "Storage Units" },
                        { key: "templates", label: "Templates" },
                      ].map((tab) => {
                        const isActive = rightPanelTab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            onClick={() => setRightPanelTab(tab.key)}
                            style={{
                              padding: "8px 10px",
                              border: "none",
                              borderBottom: isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: isActive ? 700 : 400,
                              color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                              fontFamily: "inherit",
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0, width: "100%", boxSizing: "border-box" }}>
                    {selectedUnit ? (
                      <>
                        {/* SETTINGS for the selected storage unit */}
                        <div style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}>
                          <StorageLocationPanel storageUnitId={selectedStorageUnitId} />
                        </div>
                        <div style={{ height: "1px", background: "var(--border-light)" }} />
                        <div style={{ padding: "12px", boxSizing: "border-box" }}>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ width: "100%" }}
                            onClick={handleDeleteSelectedUnit}
                          >
                            Delete &quot;{selectedUnit.name}&quot;
                          </button>
                        </div>
                      </>
                    ) : rightPanelTab === "units" ? (
                      <>
                        {/* STORAGE UNITS TAB - all unique storage units placed on this floor map */}
                        <div style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}>
                          <StoragePanel floorMapId={currentFloorMap?._id} />
                        </div>
                        <div style={{ height: "1px", background: "var(--border-light)" }} />
                        <div style={{ padding: "12px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8 }}>
                          {units.length === 0 ? (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
                              No storage units on this floor map yet.
                            </div>
                          ) : (
                            units.map((unit) => (
                              <UnitCard
                                key={unit.id ?? unit._id}
                                unit={unit}
                                onClick={() => handleUnitSelect(unit.id ?? unit._id)}
                              />
                            ))
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* TEMPLATES TAB - reusable shape templates, draggable onto the canvas */}
                        <div style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}>
                          <CustomShapesPanel
                            mapShapes={mapShapes}
                            activeTool={activeTool}
                            setActiveTool={setActiveTool}
                          />
                        </div>
                        <div style={{ padding: "0 12px 12px", boxSizing: "border-box" }}>
                          <button
                            type="button"
                            onClick={() => setIsCreateShapeOpen(true)}
                            style={{
                              ...buttonStyles.base,
                              ...buttonStyles.secondary,
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: 12,
                            }}
                          >
                            + New Shape
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, borderTop: "1px solid var(--border-light)", padding: "14px" }}>
                    <button onClick={() => setCanvasEditMode(false)} className="btn-primary" style={{ width: "100%" }}>
                      Exit Edit Mode
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  width: "32px", flexShrink: 0, background: "var(--card-bg)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", paddingTop: "14px", gap: "8px", flex: 1,
                }}>
                  <button
                    onClick={() => setSidebarOpen(true)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px", padding: "4px" }}
                    aria-label="Expand sidebar"
                  >←</button>
                </div>
              )}
            </>
          )}

        </div>{/* end right column */}
      </div>

      {/* HOVER TOOLTIP */}
      {tooltip &&
        (() => {
          const tipItems = tooltip.items ?? [];
          const tipLow = tipItems.filter((i) => i.isLow);
          const tipHasLow = tipLow.length > 0;
          return (
            <div
              style={{
                position: "fixed",
                left: tooltip.x,
                top: tooltip.y,
                background: "white",
                border: `1px solid ${tipHasLow ? "#fca5a5" : tipItems.length === 0 ? "#d9cfc0" : "#86efac"}`,
                borderRadius: "8px",
                padding: "10px 14px",
                minWidth: "160px",
                maxWidth: "240px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                fontSize: "12px",
                fontFamily: "Inter, sans-serif",
                color: "#1a1a1a",
                pointerEvents: "none",
                zIndex: 200,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: "6px",
                  color: tipItems.length === 0 ? "#998874" : tipHasLow ? "#991b1b" : "#166534",
                }}
              >
                {tooltip.unit.name}
              </div>
              {tipItems.length === 0 ? (
                <div style={{ color: "#998874", fontSize: "11px" }}>No products on this shelf</div>
              ) : tipHasLow ? (
                <>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#991b1b",
                      marginBottom: "4px",
                      fontWeight: 600,
                    }}
                  >
                    Low stock products:
                  </div>
                  {tipLow.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "4px 0",
                        borderBottom: "0.5px solid #f5efe6",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{item.product.name}</span>
                        <span
                          style={{
                            color: "#991b1b",
                            fontWeight: 600,
                            marginLeft: "8px",
                          }}
                        >
                          {item.quantity} left
                        </span>
                      </div>
                      <span style={{ fontSize: "10px", color: "#998874" }}>
                        {item.locationName}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ color: "#166534", fontSize: "11px" }}>
                  All products on this shelf are stocked
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

      {/* CREATE SHAPE MODAL */}
      {isCreateShapeOpen && (
        <CreateShapeModal
          onClose={() => setIsCreateShapeOpen(false)}
        />
      )}

    </div>
  );
}

export function FloorMapPage() {
  const { floorMapId } = useParams();
  return (
    <EditorProvider key={floorMapId ?? "default"} floorMapId={floorMapId}>
      <FloorMapPageInner />
    </EditorProvider>
  );
}
