import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { FloorMaps, Sites, MapShapes } from "/imports/api/locations/collections";
import { EditorProvider, useEditor } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { FloorMapSettingsModal } from "./floorMapComponents/FloorMapSettingsModal";
import { EditorSettingsModal } from "./floorMapComponents/EditorSettingsModal";
import { CreateShapeModal } from "./floorMapComponents/CreateShapeModal";
import { StorageLocationPanel } from "./floorMapComponents/StorageLocationPanel";
import { UnitDetailsPanel } from "./floorMapComponents/UnitDetailsPanel";
import { UnitStocktakePanel } from "./floorMapComponents/UnitStocktakePanel";
import { UnitCard } from "./floorMapComponents/UnitCard";
import { CustomShapesPanel } from "./floorMapComponents/CustomShapesPanel";
import { EditorTabs, MapSelectors, MapState } from "./floorMapComponents/MapControls";
import { MapActions } from "./floorMapComponents/MapActions";
import { FloorMapIcon } from "./floorMapComponents/FloorMapIcon";
import { firstMapForSite, selectAvailableMap } from "./floorMapComponents/mapSelection";
import "./FloorMapPage.css";

function MapTooltip({ tooltip }) {
  if (!tooltip) return null;
  const items = tooltip.items ?? [];
  const lowItems = items.filter((item) => item.isLow);
  const tone = lowItems.length ? "low" : items.length ? "ok" : "empty";
  return (
    <div
      className={`floor-map-tooltip floor-map-tooltip--${tone}`}
      style={{
        left: Math.max(12, Math.min(tooltip.x, window.innerWidth - 250)),
        top: Math.max(12, Math.min(tooltip.y, window.innerHeight - 180)),
      }}
      role="tooltip"
    >
      <strong>{tooltip.unit.name}</strong>
      {lowItems.length ? (
        <>
          <span>Low stock products</span>
          {lowItems.map((item) => (
            <div key={item.locationId ?? item.product._id} className="floor-map-tooltip-item">
              {item.product.name} · {item.quantity} left
              <small>{item.locationName}</small>
            </div>
          ))}
        </>
      ) : (
        <span>
          {items.length ? "All products on this shelf are stocked" : "No products on this shelf"}
        </span>
      )}
    </div>
  );
}

function EditorPanel({
  selectedUnit,
  onBack,
  isChangingShape,
  units,
  rightPanelTab,
  setRightPanelTab,
  mapShapes,
  activeTool,
  setActiveTool,
  onEditShape,
  onDeleteShape,
  onChangeShape,
  onRename,
  onColourChange,
  selectedStorageUnitId,
  onChangeShapeClick,
  onDeleteUnit,
  onNewShape,
  onSelectUnit,
  onClose,
  mobile,
  expanded,
  onToggleExpand,
  panelRef,
  onShapeAdded,
}) {
  return (
    <div
      className="floor-map-editor"
      ref={panelRef}
      role={mobile ? "dialog" : "complementary"}
      aria-modal={mobile && expanded ? "true" : undefined}
      aria-labelledby="floor-map-editor-title"
    >
      <div className="floor-map-panel-heading">
        <div className="floor-map-panel-heading-main">
          {selectedUnit && (
            <button
              type="button"
              className="floor-map-icon-button"
              onClick={onBack}
              aria-label={isChangingShape ? "Back to unit details" : "Back to storage units"}
              title={isChangingShape ? "Back to unit details" : "Back to storage units"}
            >
              <FloorMapIcon name="arrow-left" />
            </button>
          )}
          <div>
            <span className="floor-map-eyebrow">Layout editor</span>
            <h2 id="floor-map-editor-title">
              {isChangingShape
                ? `Change ${selectedUnit.name} shape`
                : selectedUnit
                  ? `Edit ${selectedUnit.name}`
                  : "Map tools"}
            </h2>
          </div>
        </div>
        <div className="floor-map-panel-heading-actions">
          {mobile && (
            <button
              type="button"
              className="floor-map-icon-button"
              onClick={onToggleExpand}
              aria-label={expanded ? "Use compact editor panel" : "Expand editor panel"}
              aria-expanded={expanded}
              title={expanded ? "Use compact panel" : "Expand panel"}
            >
              <FloorMapIcon name={expanded ? "collapse" : "expand"} />
            </button>
          )}
          <button
            type="button"
            className="floor-map-icon-button"
            onClick={onClose}
            aria-label={mobile ? "Close editor panel" : "Collapse editor panel"}
            title={mobile ? "Close editor panel" : "Collapse editor panel"}
          >
            <FloorMapIcon name={mobile ? "close" : "panel-close"} />
          </button>
        </div>
      </div>
      {!selectedUnit && <EditorTabs activeTab={rightPanelTab} onChange={setRightPanelTab} />}
      <div className="floor-map-panel-scroll">
        {selectedUnit ? (
          isChangingShape ? (
            <div className="floor-map-panel-section">
              <CustomShapesPanel
                mapShapes={mapShapes}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                onEditShape={onEditShape}
                onDeleteShape={onDeleteShape}
                isChangingShape
                onChangeShape={onChangeShape}
                mobile={mobile}
              />
            </div>
          ) : (
            <>
              <div className="floor-map-panel-section">
                <UnitDetailsPanel
                  unit={selectedUnit}
                  onRename={onRename}
                  onColourChange={onColourChange}
                />
              </div>
              <div className="floor-map-panel-section">
                {selectedUnit._id ? (
                  <StorageLocationPanel storageUnitId={selectedStorageUnitId} />
                ) : (
                  <p className="floor-map-panel-empty">
                    Save the layout before adding storage locations to this unit.
                  </p>
                )}
              </div>
              <div className="floor-map-panel-section floor-map-panel-actions">
                <button type="button" className="btn-primary" onClick={onChangeShapeClick}>
                  <FloorMapIcon name="templates" />
                  <span>Change shape</span>
                </button>
                <button type="button" className="btn-danger" onClick={onDeleteUnit}>
                  <FloorMapIcon name="trash" />
                  <span>Delete &quot;{selectedUnit.name}&quot;</span>
                </button>
              </div>
            </>
          )
        ) : rightPanelTab === "units" ? (
          <div
            className="floor-map-panel-section"
            role="tabpanel"
            id="floor-map-tabpanel-units"
            aria-labelledby="floor-map-tab-units"
          >
            {units.length ? (
              units.map((unit) => (
                <UnitCard
                  key={unit.id ?? unit._id}
                  unit={unit}
                  onClick={() => onSelectUnit(unit.id ?? unit._id)}
                />
              ))
            ) : (
              <p className="floor-map-panel-empty">No storage units yet. Add one from Templates.</p>
            )}
          </div>
        ) : (
          <div
            className="floor-map-panel-section"
            role="tabpanel"
            id="floor-map-tabpanel-templates"
            aria-labelledby="floor-map-tab-templates"
          >
            <CustomShapesPanel
              mapShapes={mapShapes}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              onEditShape={onEditShape}
              onDeleteShape={onDeleteShape}
              mobile={mobile}
              onShapeAdded={onShapeAdded}
            />
            <button
              type="button"
              className="floor-map-button floor-map-panel-new"
              onClick={onNewShape}
            >
              <FloorMapIcon name="plus" />
              <span>New shape</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FloorMapPageInner() {
  const { role } = useAuth();
  const canManage = hasClientPermission(role, "locations.manage");
  const canStocktake = hasClientPermission(role, "stocktake.save");
  const { floorMapId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const menuRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const panelRef = useRef(null);
  const editorTriggerRef = useRef(null);
  const stockTriggerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [stockPanelOpen, setStockPanelOpen] = useState(false);
  const [createShapeOpen, setCreateShapeOpen] = useState(false);
  const [editingShape, setEditingShape] = useState(null);
  const [changingShape, setChangingShape] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState("units");

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
    isCanvasEditMode,
    setCanvasEditMode,
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

  const { sites, floorMaps, mapShapes, locationsReady } = useTracker(() => {
    const handle = Meteor.subscribe("locations.all");
    return {
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      mapShapes: MapShapes.find({}, { sort: { name: 1 } }).fetch(),
      locationsReady: handle.ready(),
    };
  }, []);

  const currentFloorMap = selectAvailableMap(floorMaps, floorMapId);
  const currentSite = sites.find((site) => site._id === currentFloorMap?.siteId);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (locationsReady && currentFloorMap && floorMapId !== currentFloorMap._id) {
      navigate(`/floor-map/${currentFloorMap._id}`, { replace: true });
    }
  }, [locationsReady, currentFloorMap, floorMapId, navigate]);

  useEffect(() => {
    if (mobilePanelOpen) panelRef.current?.querySelector("button")?.focus();
  }, [mobilePanelOpen]);

  useEffect(() => {
    if (stockPanelOpen && isMobile)
      document.querySelector(".floor-map-stock-wrap .panel-close-btn")?.focus();
  }, [stockPanelOpen, isMobile]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Tab" && mobilePanelOpen && mobileExpanded) {
        const controls = [
          ...(panelRef.current?.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
          ) ?? []),
        ];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if (event.key !== "Escape") return;
      if (createShapeOpen) {
        setCreateShapeOpen(false);
        setEditingShape(null);
      } else if (isFloorMapSettingsOpen) setFloorMapSettingsOpen(false);
      else if (isEditorSettingsOpen) setEditorSettingsOpen(false);
      else if (moreOpen) {
        setMoreOpen(false);
        menuTriggerRef.current?.focus();
      } else if (mobilePanelOpen) closeMobilePanel();
      else if (stockPanelOpen) closeStockPanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!moreOpen) return;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    function outside(event) {
      if (!menuRef.current?.contains(event.target)) setMoreOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [moreOpen]);

  function closeMobilePanel() {
    setMobilePanelOpen(false);
    setMobileExpanded(false);
    editorTriggerRef.current?.focus();
  }

  function closeStockPanel() {
    setStockPanelOpen(false);
    setSelectedStorageUnitId(null);
    setSelectedUnit(null);
    stockTriggerRef.current?.focus();
  }

  function selectUnit(unitId) {
    const unit = units.find((item) => (item.id ?? item._id) === unitId) ?? null;
    setSelectedStorageUnitId(unitId);
    setSelectedUnit(unit);
    setStockPanelOpen(Boolean(unitId) && !isCanvasEditMode);
    if (unitId && isCanvasEditMode && isMobile) setMobilePanelOpen(true);
  }

  function toggleMode() {
    if (!canManage) return;
    if (isCanvasEditMode) {
      selectUnit(null);
      setMobilePanelOpen(false);
      setTooltip(null);
    } else if (isMobile) {
      setMobileExpanded(false);
      setMobilePanelOpen(true);
    }
    setCanvasEditMode(!isCanvasEditMode);
  }

  function updateUnit(patch) {
    if (!selectedUnit) return;
    const id = selectedUnit.id ?? selectedUnit._id;
    commitUnits((previous) =>
      previous.map((unit) => ((unit.id ?? unit._id) === id ? { ...unit, ...patch } : unit)),
    );
    setSelectedUnit((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  const editorVisible = canManage && isCanvasEditMode;
  const stockVisible = !isCanvasEditMode && selectedUnit && stockPanelOpen;

  return (
    <section
      className={`floor-map-workspace${editorVisible ? " floor-map-workspace--editing" : ""}`}
      aria-label="Floor map workspace"
    >
      <header className="floor-map-toolbar">
        <div className="floor-map-toolbar-main">
          <div className="floor-map-title-block">
            <span className="floor-map-eyebrow">Workspace</span>
            <h1>Floor Map</h1>
          </div>
          {locationsReady && currentFloorMap && (
            <MapSelectors
              sites={sites}
              floorMaps={floorMaps}
              currentSite={currentSite}
              currentFloorMap={currentFloorMap}
              onSiteChange={(siteId) => {
                const map = firstMapForSite(floorMaps, siteId);
                if (map) navigate(`/floor-map/${map._id}`);
              }}
              onFloorMapChange={(mapId) => navigate(`/floor-map/${mapId}`)}
            />
          )}
        </div>
        <MapActions
          canManage={canManage}
          editing={editorVisible}
          onSave={handleSaveLayout}
          onToggleMode={toggleMode}
          isMobile={isMobile}
          panelOpen={isMobile ? mobilePanelOpen : sidebarOpen}
          onTogglePanel={() => (isMobile ? setMobilePanelOpen(true) : setSidebarOpen(!sidebarOpen))}
          panelTriggerRef={editorTriggerRef}
          menuRef={menuRef}
          menuTriggerRef={menuTriggerRef}
          moreOpen={moreOpen}
          onToggleMore={() => setMoreOpen(!moreOpen)}
          onExport={() => {
            canvasRef.current?.exportPng();
            setMoreOpen(false);
          }}
          onFloorSettings={() => {
            setFloorMapSettingsOpen(true);
            setMoreOpen(false);
          }}
          onEditorSettings={() => {
            setEditorSettingsOpen(true);
            setMoreOpen(false);
          }}
        />
      </header>

      <div className="floor-map-body">
        <div className="floor-map-viewport" ref={stockTriggerRef} tabIndex={-1}>
          {!locationsReady ? (
            <MapState loading title="Loading floor maps…" />
          ) : !currentFloorMap ? (
            <MapState
              title="No floor maps yet"
              description="Add a site and floor map to start planning this space."
            />
          ) : (
            <Canvas
              ref={canvasRef}
              key={currentFloorMap._id}
              isCanvasEditMode={editorVisible}
              selectedStorageUnitId={selectedStorageUnitId}
              setSelectedStorageUnitId={selectUnit}
              setTooltip={isMobile ? undefined : setTooltip}
              lowStockByUnitId={lowStockByUnitId}
            />
          )}
        </div>
        {stockVisible && (
          <div
            className="floor-map-stock-wrap"
            role={isMobile ? "dialog" : "complementary"}
            aria-modal={isMobile ? "true" : undefined}
            aria-label={`Stocktake for ${selectedUnit.name}`}
          >
            <UnitStocktakePanel
              unit={selectedUnit}
              canStocktake={canStocktake}
              onClose={closeStockPanel}
            />
          </div>
        )}
        {editorVisible && (
          <div
            id="floor-map-editor-wrap"
            className={`floor-map-editor-wrap${sidebarOpen ? "" : " is-collapsed"}${mobilePanelOpen ? " is-mobile-open" : ""}${mobileExpanded ? " is-expanded" : ""}`}
          >
            {!isMobile && !sidebarOpen ? (
              <button
                type="button"
                className="floor-map-expand"
                onClick={() => setSidebarOpen(true)}
                aria-label="Expand editor panel"
                title="Expand editor panel"
              >
                <FloorMapIcon name="panel" />
              </button>
            ) : (
              <EditorPanel
                selectedUnit={selectedUnit}
                onBack={() => (changingShape ? setChangingShape(false) : selectUnit(null))}
                isChangingShape={changingShape}
                units={units}
                rightPanelTab={rightPanelTab}
                setRightPanelTab={setRightPanelTab}
                mapShapes={mapShapes}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                onEditShape={(shape) => {
                  setEditingShape(shape);
                  setCreateShapeOpen(true);
                }}
                onDeleteShape={handleDeleteShape}
                onChangeShape={handleChangeShape}
                onRename={(name) => updateUnit({ name })}
                onColourChange={(fill) => updateUnit({ fill })}
                selectedStorageUnitId={selectedStorageUnitId}
                onChangeShapeClick={() => setChangingShape(true)}
                onDeleteUnit={handleDeleteSelectedUnit}
                onNewShape={() => {
                  setEditingShape(null);
                  setCreateShapeOpen(true);
                }}
                onSelectUnit={selectUnit}
                onClose={() => (isMobile ? closeMobilePanel() : setSidebarOpen(false))}
                mobile={isMobile}
                expanded={mobileExpanded}
                onToggleExpand={() => setMobileExpanded(!mobileExpanded)}
                panelRef={panelRef}
                onShapeAdded={(unit) => {
                  setSelectedStorageUnitId(unit.id);
                  setSelectedUnit(unit);
                  setMobileExpanded(false);
                }}
              />
            )}
          </div>
        )}
      </div>
      {isMobile && editorVisible && mobilePanelOpen && mobileExpanded && (
        <button
          type="button"
          className="floor-map-sheet-scrim"
          onClick={closeMobilePanel}
          aria-label="Close editor panel"
        />
      )}
      <MapTooltip tooltip={tooltip} />
      {isFloorMapSettingsOpen && (
        <FloorMapSettingsModal
          floorSize={floorSize}
          gridInterval={canvasSettings.gridInterval}
          onSave={handleFloorMapSettingsSave}
          onClose={() => setFloorMapSettingsOpen(false)}
        />
      )}
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
      {createShapeOpen && (
        <CreateShapeModal
          shape={editingShape}
          onClose={() => {
            setCreateShapeOpen(false);
            setEditingShape(null);
          }}
        />
      )}
    </section>
  );
}

export function FloorMapPage() {
  const { floorMapId } = useParams();
  const { role } = useAuth();
  const canManage = hasClientPermission(role, "locations.manage");
  const [editRequested, setEditRequested] = useState(false);
  return (
    <EditorProvider
      key={floorMapId ?? "default"}
      floorMapId={floorMapId}
      isCanvasEditMode={canManage && editRequested}
      setCanvasEditMode={(value) => {
        if (canManage) setEditRequested(value);
      }}
    >
      <FloorMapPageInner />
    </EditorProvider>
  );
}
