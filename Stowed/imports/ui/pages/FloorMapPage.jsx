import { useState, useRef } from "react";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { CANVAS_MODES, EditorProvider, useEditor} from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { FloorMapSettingsModal } from "./floorMapComponents/FloorMapSettingsModal";
import { EditorSettingsModal } from "./floorMapComponents/EditorSettingsModal";
import { pageStyles, COLOURS } from "./floorMapComponents/FloorMapStyles";
import { useParams, useNavigate } from "react-router-dom";
import { StorageLocationPanel } from "./floorMapComponents/StorageLocationPanel";
import { UnitDetailsPanel } from "./floorMapComponents/UnitDetailsPanel";
import { UnitStocktakePanel } from "./floorMapComponents/UnitStocktakePanel";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { FloorMaps, Sites, StorageUnits, MapShapes } from "/imports/api/locations/collections";
import "../Global.css";
import "./FloorMapPage.css";
import { CreateShapeModal } from "./floorMapComponents/CreateShapeModal";
import { UnitCard } from "./floorMapComponents/UnitCard";
import { CustomShapesPanel } from "./floorMapComponents/CustomShapesPanel";
import { RouteToolbar } from "./floorMapComponents/RouteToolbar";
import { buttonStyles } from "./floorMapComponents/FloorMapStyles";

const statusBarButtonStyle = {
  fontSize: "12px",
  fontWeight: 600,
  color: COLOURS.TEXT_PRIMARY,
  background: COLOURS.CARD_BG,
  border: `1px solid ${COLOURS.CARD_BORDER}`,
  borderRadius: "8px",
  padding: "6px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};

const iconButtonStyle = (isActive = false) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  padding: 0,
  borderRadius: "999px",
  border: `1px solid ${isActive ? COLOURS.ACCENT : COLOURS.CARD_BORDER}`,
  color: isActive ? COLOURS.ACCENT : COLOURS.TEXT_MUTED,
  background: isActive ? COLOURS.ACCENT_SOFT : COLOURS.INPUT_BG,
  cursor: "pointer",
});

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function FloorMapPageInner() {
  const { role } = useAuth();
  const canManage = hasClientPermission(role, "locations.manage");
  const canStocktake = hasClientPermission(role, "stocktake.save");
  const canvasRef = useRef(null);

  const {
    activeTool,
    setActiveTool,
    floorSize,
    isFloorMapSettingsOpen,
    setFloorMapSettingsOpen,
    handleFloorMapSettingsSave,
    canvasSettings,
    isEditorSettingsOpen,
    setEditorSettingsOpen,
    handleEditorSettingsSave,
    canvasMode,
    setCanvasMode,
    isCanvasEditMode,
    activeRouteTool,
    setActiveRouteTool,
    units,
    commitUnits,
    handleSaveLayout,
    selectedUnit,
    setSelectedUnit,
    lowStockByUnitId,
    handleDeleteSelectedUnit,
    handleDeleteShape,
    handleChangeShape,
  } = useEditor();

  const { floorMapId } = useParams();
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [isStockPanelOpen, setIsStockPanelOpen] = useState(false);
  const [isCreateShapeOpen, setIsCreateShapeOpen] = useState(false);
  const [editingShape, setEditingShape] = useState(null);
  const [isChangingShape, setIsChangingShape] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState("units"); // "units" | "templates"

  // Fetch all sites, floor maps, storage units and shapes
  const { sites, floorMaps, mapShapes, locationsReady } = useTracker(() => {
    const handle = Meteor.subscribe("locations.all");
    return {
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      storageUnits: StorageUnits.find({}, { sort: { createdAt: 1 } }).fetch(),
      mapShapes: MapShapes.find({}, { sort: { name: 1 } }).fetch(),
      locationsReady: handle.ready(),
    };
  }, []);

  const handleUnitSelect = (unitId) => {
    setSelectedStorageUnitId(unitId);
    const unit = units.find((u) => u._id === unitId || u.id === unitId) ?? null;
    setSelectedUnit(unit);
    setIsStockPanelOpen(!!unitId);
  };

  const handleCanvasModeChange = (nextMode) => {
    if (nextMode === canvasMode) return;
    setSelectedStorageUnitId(null);
    setSelectedUnit(null);
    setIsStockPanelOpen(false);
    setTooltip(null);

    setCanvasMode(nextMode);
  };
  const handleEditShape = (shape) => {
    setEditingShape(shape);
    setIsCreateShapeOpen(true);
  };

  const updateSelectedUnit = (patch) => {
    if (!selectedUnit) return;
    const uid = selectedUnit.id ?? selectedUnit._id;
    commitUnits((prev) => prev.map((u) => ((u.id ?? u._id) === uid ? { ...u, ...patch } : u)));
    setSelectedUnit((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // Current floor map
  const currentFloorMap = floorMaps.find((f) => f._id === floorMapId) ?? floorMaps[0];
  const currentSite = sites.find((s) => s._id === currentFloorMap?.siteId);
  const siteFloorMaps = currentSite ? floorMaps.filter((f) => f.siteId === currentSite._id) : [];

  // Thin strip shown in place of the edit/route sidebar when it is collapsed
  const collapsedSidebar = (
    <div
      style={{
        width: "32px",
        flexShrink: 0,
        background: COLOURS.CARD_BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "14px",
        gap: "8px",
        flex: 1,
      }}
    >
      <button
        onClick={() => setSidebarOpen(true)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: COLOURS.TEXT_MUTED,
          fontSize: "14px",
          padding: "4px",
        }}
        aria-label="Expand sidebar"
      >
        <img src="/sidebar-expand.svg" alt="" width="18" height="18" />
      </button>
    </div>
  );

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
          borderBottom: `1px solid ${COLOURS.CARD_BORDER}`,
          background: COLOURS.CARD_BG,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
          {sites.length > 0 ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
              {/* WAREHOUSE (SITE) SELECT */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: COLOURS.TEXT_MUTED,
                  }}
                >
                  Site
                </span>
                <select
                  value={currentSite?._id ?? ""}
                  onChange={(e) => {
                    const targetSiteId = e.target.value;
                    const targetMap = floorMaps.find((f) => f.siteId === targetSiteId);
                    if (targetMap) navigate(`/floor-map/${targetMap._id}`);
                  }}
                  aria-label="Select site"
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: COLOURS.TEXT_PRIMARY,
                    background: COLOURS.CARD_BG,
                    border: `1px solid ${COLOURS.CARD_BORDER}`,
                    borderRadius: "8px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {sites.map((site) => (
                    <option key={site._id} value={site._id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* FLOOR MAP SELECT - only shown when the selected site has more than one floor map */}
              {currentSite && siteFloorMaps.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: COLOURS.TEXT_MUTED,
                    }}
                  >
                    Floor Map
                  </span>
                  <select
                    value={currentFloorMap?._id ?? ""}
                    onChange={(e) => navigate(`/floor-map/${e.target.value}`)}
                    aria-label="Select floor map"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: COLOURS.TEXT_MUTED,
                      background: COLOURS.CARD_BG,
                      border: `1px solid ${COLOURS.CARD_BORDER}`,
                      borderRadius: "8px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {siteFloorMaps.map((fm) => (
                      <option key={fm._id} value={fm._id}>
                        {fm.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize: "13px", fontWeight: 700, color: COLOURS.TEXT_PRIMARY }}>
              {currentFloorMap?.name ?? "Floor Map"}
            </span>
          )}

          {/* SAVE LAYOUT */}
          {isCanvasEditMode && canManage && (
            <button
              type="button"
              onClick={handleSaveLayout}
              style={{
                ...statusBarButtonStyle,
                background: COLOURS.ACCENT,
                borderColor: COLOURS.ACCENT,
                color: "white",
              }}
            >
              Save Layout
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* FLOOR MAP SETTINGS */}
          {isCanvasEditMode && canManage && (
            <button
              type="button"
              onClick={() => setFloorMapSettingsOpen(true)}
              style={statusBarButtonStyle}
            >
              Floor Map Settings
            </button>
          )}

          {/* MODE SWITCHER */}
          <div role="group" aria-label="Floor map mode" style={{ display: "flex", gap: "6px" }}>
            {[
              { mode: CANVAS_MODES.VIEW, label: "View", requiresManage: false },
              { mode: CANVAS_MODES.EDIT, label: "Edit", requiresManage: true },
              { mode: CANVAS_MODES.ROUTE, label: "Route", requiresManage: true },
            ].map(({ mode, label, requiresManage }) => {
              const isActive = canvasMode === mode;
              const isDisabled = requiresManage && !canManage;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleCanvasModeChange(mode)}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: `1px solid ${isActive ? COLOURS.ACCENT : COLOURS.CARD_BORDER}`,
                    color: isActive ? COLOURS.ACCENT : COLOURS.TEXT_MUTED,
                    background: isActive ? COLOURS.ACCENT_SOFT : COLOURS.INPUT_BG,
                    cursor: isDisabled ? "not-allowed" : isActive ? "default" : "pointer",
                    opacity: isDisabled ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* EXPORT AS PNG */}
          <button
            type="button"
            onClick={() => canvasRef.current?.exportPng()}
            aria-label="Export as PNG"
            title="Export as PNG"
            style={iconButtonStyle()}
          >
            <svg {...ICON_PROPS}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* EDITOR SETTINGS - available in every mode */}
          <button
            type="button"
            onClick={() => setEditorSettingsOpen(true)}
            aria-label="Editor settings"
            title="Editor settings"
            style={iconButtonStyle(isEditorSettingsOpen)}
          >
            <svg {...ICON_PROPS}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

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
              ref={canvasRef}
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            height: "100%",
            borderLeft: `1px solid ${COLOURS.CARD_BORDER}`,
          }}
        >
          {/* STOCKTAKE SLIDE-OUT PANEL - view mode only */}
          {selectedUnit && isStockPanelOpen && canvasMode === CANVAS_MODES.VIEW && (
            <UnitStocktakePanel
              unit={selectedUnit}
              canStocktake={canStocktake}
              onClose={() => setIsStockPanelOpen(false)}
            />
          )}

          {/* EDIT MODE SIDEBAR - only accessible to admins/owners */}
          {isCanvasEditMode && canManage && (
            <>
              {isSidebarOpen ? (
                <div
                  style={{
                    width: "260px",
                    minWidth: "260px",
                    maxWidth: "260px",
                    flexShrink: 0,
                    background: COLOURS.CARD_BG,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    flex: 1,
                  }}
                >
                  {selectedUnit ? (
                    <div
                      className="section-title"
                      style={{
                        padding: "14px",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => {
                          isChangingShape ? setIsChangingShape(false) : handleUnitSelect(null);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: COLOURS.TEXT_MUTED,
                          fontSize: "13px",
                          padding: 0,
                          marginRight: "8px",
                        }}
                        aria-label="Back to list"
                      >
                        ←
                      </button>
                      <span style={{ fontWeight: 700, color: COLOURS.TEXT_PRIMARY }}>
                        Edit &quot;{selectedUnit.name}&quot;
                      </span>
                      <button
                        onClick={() => setSidebarOpen(false)}
                        style={{
                          ...pageStyles.sidebarToggle,
                          fontSize: "11px",
                          padding: "4px 8px",
                          marginLeft: "auto",
                        }}
                        aria-label="Collapse sidebar"
                      >
                        <img src="/sidebar-collapse.svg" alt="" width="18" height="18" />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "0 8px 0 14px",
                        flexShrink: 0,
                        borderBottom: `1px solid ${COLOURS.CARD_BORDER}`,
                      }}
                    >
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
                              borderBottom: isActive
                                ? `2px solid ${COLOURS.ACCENT}`
                                : "2px solid transparent",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: isActive ? 700 : 400,
                              color: isActive ? COLOURS.ACCENT : COLOURS.TEXT_MUTED,
                              fontFamily: "inherit",
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setSidebarOpen(false)}
                        style={{
                          ...pageStyles.sidebarToggle,
                          fontSize: "11px",
                          padding: "4px 8px",
                          marginLeft: "auto",
                        }}
                        aria-label="Collapse sidebar"
                      >
                        <img src="/sidebar-collapse.svg" alt="" width="18" height="18" />
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      overflowX: "hidden",
                      minHeight: 0,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {selectedUnit && isChangingShape ? (
                      //dd
                      <div style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}>
                        <CustomShapesPanel
                          mapShapes={mapShapes}
                          activeTool={activeTool}
                          setActiveTool={setActiveTool}
                          onEditShape={handleEditShape}
                          onDeleteShape={handleDeleteShape}
                          isChangingShape={isChangingShape}
                          onChangeShape={handleChangeShape}
                        />
                      </div>
                    ) : selectedUnit ? (
                      <>
                        {/* SETTINGS for the selected storage unit */}
                        <div
                          style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}
                        >
                          <UnitDetailsPanel
                            unit={selectedUnit}
                            onRename={(name) => updateSelectedUnit({ name })}
                            onColourChange={(fill) => updateSelectedUnit({ fill })}
                          />
                        </div>
                        <div style={{ height: "1px", background: COLOURS.CARD_BORDER }} />
                        <div
                          style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}
                        >
                          <StorageLocationPanel storageUnitId={selectedStorageUnitId} />
                        </div>
                        <div style={{ height: "1px", background: COLOURS.CARD_BORDER }} />
                        <div style={{ padding: "12px", boxSizing: "border-box" }}>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ width: "100%" }}
                            onClick={() => setIsChangingShape(true)}
                          >
                            Change Shape
                          </button>

                          <div style={{ height: "8px" }} />

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
                        {/* STORAGE UNITS TAB */}
                        <div
                          style={{
                            padding: "12px",
                            boxSizing: "border-box",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {units.length === 0 ? (
                            <div
                              style={{
                                fontSize: "11px",
                                color: COLOURS.TEXT_MUTED,
                                textAlign: "center",
                                padding: "8px 0",
                              }}
                            >
                              No storage units on this floor map yet. Drag a shape from the
                              Templates tab onto the canvas to create one.
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
                        <div
                          style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}
                        >
                          <CustomShapesPanel
                            mapShapes={mapShapes}
                            activeTool={activeTool}
                            setActiveTool={setActiveTool}
                            onEditShape={handleEditShape}
                            onDeleteShape={handleDeleteShape}
                          />
                        </div>
                        <div style={{ padding: "0 12px 12px", boxSizing: "border-box" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingShape(null);
                              setIsCreateShapeOpen(true);
                            }}
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
                </div>
              ) : (
                collapsedSidebar
              )}
            </>
          )}

          {/* ROUTE MODE SIDEBAR */}
          {canvasMode === CANVAS_MODES.ROUTE &&
            canManage &&
            (isSidebarOpen ? (
              <RouteToolbar
                activeTool={activeRouteTool}
                onSelectTool={setActiveRouteTool}
                onCollapse={() => setSidebarOpen(false)}
              />
            ) : (
              collapsedSidebar
            ))}
        </div>
        {/* end right column */}
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

      {/* FLOOR MAP SETTINGS MODAL */}
      {isFloorMapSettingsOpen && (
        <FloorMapSettingsModal
          floorSize={floorSize}
          gridInterval={canvasSettings.gridInterval}
          onSave={handleFloorMapSettingsSave}
          onClose={() => setFloorMapSettingsOpen(false)}
        />
      )}

      {/* EDITOR SETTINGS MODAL*/}
      {isEditorSettingsOpen && (
        <EditorSettingsModal
          gridInterval={canvasSettings.gridInterval}
          snapInterval={canvasSettings.snapInterval}
          showGrid={canvasSettings.showGrid}
          snapToGrid={canvasSettings.snapToGrid}
          onSave={handleEditorSettingsSave}
          onClose={() => setEditorSettingsOpen(false)}
          floorSize={floorSize}
        />
      )}

      {/* CREATE / EDIT SHAPE MODAL */}
      {isCreateShapeOpen && (
        <CreateShapeModal
          shape={editingShape}
          onClose={() => {
            setIsCreateShapeOpen(false);
            setEditingShape(null);
          }}
        />
      )}
    </div>
  );
}

export function FloorMapPage() {
  const { floorMapId } = useParams();
  // Owned here (outside the remounted EditorProvider) so the current mode
  // persists when switching between floor maps / warehouses.
  const [canvasMode, setCanvasMode] = useState(CANVAS_MODES.VIEW);
  return (
    <EditorProvider
      key={floorMapId ?? "default"}
      floorMapId={floorMapId}
      canvasMode={canvasMode}
      setCanvasMode={setCanvasMode}
    >
      <FloorMapPageInner />
    </EditorProvider>
  );
}
