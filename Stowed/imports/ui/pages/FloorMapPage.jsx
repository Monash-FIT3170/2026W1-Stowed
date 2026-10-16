import { useState, useRef, useEffect } from "react";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import {
  CANVAS_MODES,
  EditorProvider,
  useEditor,
} from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { FloorMapSettingsModal } from "./floorMapComponents/FloorMapSettingsModal";
import { DeleteShapeModal } from "./floorMapComponents/DeleteShapeModal";
import { EditorSettingsModal } from "./floorMapComponents/EditorSettingsModal";
import { DeleteUnitModal } from "./floorMapComponents/DeleteUnitModal";
import { pageStyles, COLOURS } from "./floorMapComponents/FloorMapStyles";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { StorageLocationPanel } from "./floorMapComponents/StorageLocationPanel";
import { UnitDetailsPanel } from "./floorMapComponents/UnitDetailsPanel";
import { UnitStocktakePanel } from "./floorMapComponents/UnitStocktakePanel";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  FloorMaps,
  Sites,
  StorageUnits,
  StorageLocations,
  MapShapes,
} from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";
import "../Global.css";
import "./FloorMapPage.css";
import { CreateShapeModal } from "./floorMapComponents/CreateShapeModal";
import { UnitCard } from "./floorMapComponents/UnitCard";
import { CustomShapesPanel } from "./floorMapComponents/CustomShapesPanel";
import { RouteToolbar } from "./floorMapComponents/RouteToolbar";
import { ProductNodeLocationsModal } from "./floorMapComponents/ProductNodeLocationsModal";
import { CollapsedSidebar, SidebarCollapseButton } from "./floorMapComponents/SidebarControls";
import {
  DownloadIcon,
  MapIcon,
  RouteIcon,
  SaveIcon,
  SettingsIcon,
} from "./floorMapComponents/FloorMapIcons";
import { MapRouteInputs } from "./floorMapComponents/MapRouteInputs";
import { MapState } from "./floorMapComponents/MapControls";
import { FloorMapIcon } from "./floorMapComponents/FloorMapIcon";
import { selectDefaultMap } from "./floorMapComponents/mapSelection";
import {
  buttonStyles,
  COLLAPSED_SIDEBAR_WIDTH_PX,
  SIDEBAR_WIDTH_PX,
  sidebarStyles,
  statusBarStyles,
} from "./floorMapComponents/FloorMapStyles";

// Mode switcher buttons, in display order
const MODE_OPTIONS = [
  { mode: CANVAS_MODES.VIEW, label: "View", requiresManage: false },
  { mode: CANVAS_MODES.EDIT, label: "Edit", requiresManage: true },
  { mode: CANVAS_MODES.ROUTE, label: "Route", requiresManage: true },
];

// Screen widths that use the mobile layout
const MOBILE_QUERY = "(max-width: 900px)";

// Tabs in the edit mode sidebar
const EDIT_SIDEBAR_TABS = [
  { key: "units", label: "Storage Units" },
  { key: "templates", label: "Templates" },
];

/**
 * Save icon for the layout or route, styled like the other status bar icons: highlighted
 * (orange) while there are unsaved changes, plain and disabled once everything is saved.
 *
 * @param {{ label: string, hasUnsavedChanges: boolean, isSaving: boolean, onSave: () => void }} props
 */
function SaveIconButton({ label, hasUnsavedChanges, isSaving, onSave }) {
  const canSave = hasUnsavedChanges && !isSaving;
  const title = isSaving
    ? `Saving ${label}...`
    : hasUnsavedChanges
      ? `Save ${label} (unsaved changes)`
      : `${label[0].toUpperCase()}${label.slice(1)} saved`;

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={!canSave}
      aria-label={title}
      title={title}
      style={statusBarStyles.saveButton(hasUnsavedChanges)}
    >
      <SaveIcon size={14} />
    </button>
  );
}

/**
 * Hover tooltip for a storage unit's stock. Lists each low stock product once, with the
 * unit's locations under it, and stays inside the window.
 */
function MapTooltip({ tooltip }) {
  if (!tooltip) return null;
  const items = tooltip.items ?? [];
  // One entry per product, with the unit's locations listed under it, so a
  // product low on two shelves of this unit is not shown twice.
  const lowByProduct = new Map();
  for (const item of items) {
    if (!item.isLow) continue;
    const entry = lowByProduct.get(item.product._id) ?? {
      product: item.product,
      locations: new Map(),
    };
    entry.locations.set(item.locationId, { name: item.locationName, quantity: item.quantity });
    lowByProduct.set(item.product._id, entry);
  }
  const lowItems = [...lowByProduct.values()];
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
          {lowItems.map(({ product, locations }) => (
            <div key={product._id} className="floor-map-tooltip-item">
              {product.name} · {product.totalQuantity} left overall
              {[...locations].map(([id, location]) => (
                <small key={id}>
                  {location.name}: {location.quantity} left
                </small>
              ))}
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
    selectRouteTool,
    isRouteDirty,
    isSavingRoute,
    handleSaveRoute,
    walkwayNodes,
    editingProductNode,
    confirmProductNodeLocations,
    cancelProductNodeEdit,
    units,
    commitUnits,
    handleSaveLayout,
    isLayoutDirty,
    isSavingLayout,
    selectedUnit,
    setSelectedUnit,
    lowStockByUnitId,
    handleDeleteSelectedUnit,
    unitPendingDelete,
    setUnitPendingDelete,
    unitIdsStagedForRemoval,
    handleConfirmDeleteWithReassign,
    handleDeleteShape,
    shapePendingDelete,
    setShapePendingDelete,
    handleConfirmDeleteShapeWithReassign,
    handleChangeShape,
  } = useEditor();

  const { floorMapId } = useParams();
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  // Blocking "Saving layout..." dialog, so nothing can be edited mid-save
  const savingDialogRef = useRef(null);

  // Mobile layout (<= 900px wide): the edit sidebar becomes a bottom sheet opened from the
  // Tools button, and the stock panel becomes a sheet too. Desktop is unaffected.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const panelRef = useRef(null);
  const editorTriggerRef = useRef(null);
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [isStockPanelOpen, setIsStockPanelOpen] = useState(false);
  const [isCreateShapeOpen, setIsCreateShapeOpen] = useState(false);
  const [editingShape, setEditingShape] = useState(null);
  const [isChangingShape, setIsChangingShape] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState("units"); // "units" | "templates"
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [startingPoint, setStartingPoint] = useState(null);
  const [isSelectingStart, setIsSelectingStart] = useState(false);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  // Result of floorMapRoutes.generate, drawn on the view map
  const [plannedRoute, setPlannedRoute] = useState(null);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

  const { products, productsReady } = useTracker(() => {
    const handle = Meteor.subscribe("products");
    return {
      products: Products.find({}, { sort: { name: 1 } }).fetch(),
      productsReady: handle.ready(),
    };
  }, []);

  // The product node whose accessible storage locations are being chosen, if any
  const editingProductNodeData = editingProductNode
    ? walkwayNodes.find((node) => node.id === editingProductNode.nodeId)
    : null;

  // In view mode there is no sidebar, so fitting would use a wider area than edit/route mode
  // and the map would jump in size when switching. Leave room for the sidebar so every mode
  // fits the map identically. Only for users who can switch modes, and not while the stock
  // panel already takes up space on the right.
  const isStockPanelShowing = Boolean(selectedUnit && isStockPanelOpen);
  const viewFitInsetRight =
    canvasMode === CANVAS_MODES.VIEW && canManage && !isStockPanelShowing && !isMobile
      ? isSidebarOpen
        ? SIDEBAR_WIDTH_PX
        : COLLAPSED_SIDEBAR_WIDTH_PX
      : 0;

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
    if (unitId && isCanvasEditMode && isMobile) setMobilePanelOpen(true);
  };

  const closeMobilePanel = () => {
    setMobilePanelOpen(false);
    setMobileExpanded(false);
    editorTriggerRef.current?.focus();
  };

  const closeStockPanel = () => {
    setIsStockPanelOpen(false);
    setSelectedStorageUnitId(null);
    setSelectedUnit(null);
  };

  /**
   * Saves the layout behind the blocking "Saving layout..." dialog.
   *
   * @returns {Promise<boolean>} Whether the save succeeded
   */
  const saveLayoutWithDialog = async ({ showSuccessAlert = true } = {}) => {
    if (!canManage || isSavingLayout || savingDialogRef.current?.open) return false;
    savingDialogRef.current?.showModal();
    try {
      return await handleSaveLayout({ showSuccessAlert });
    } catch (error) {
      console.error(error);
      alert(error.reason || "Failed to save layout. Please try again.");
      return false;
    } finally {
      savingDialogRef.current?.close();
    }
  };

  const handleCanvasModeChange = async (nextMode) => {
    if (nextMode === canvasMode || isSavingLayout) return;
    // Leaving edit mode saves the layout first; a failed save stays in edit mode so nothing is lost
    if (isCanvasEditMode && canManage && isLayoutDirty) {
      const saved = await saveLayoutWithDialog({ showSuccessAlert: false });
      if (!saved) return;
    }
    setIsSelectingStart(false);
    setSelectedStorageUnitId(null);
    setSelectedUnit(null);
    setIsStockPanelOpen(false);
    setTooltip(null);
    setIsRouteModalOpen(false);
    // On mobile, entering edit mode opens the (compact) editor sheet; other modes close it
    setMobileExpanded(false);
    setMobilePanelOpen(isMobile && nextMode === CANVAS_MODES.EDIT);

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
  const currentFloorMap = selectDefaultMap(floorMaps, sites, floorMapId);
  const currentSite = sites.find((s) => s._id === currentFloorMap?.siteId);
  const siteFloorMaps = currentSite ? floorMaps.filter((f) => f.siteId === currentSite._id) : [];
  const mapReady = locationsReady && !!currentFloorMap;

  // Only products with stock on this floor map can be picked on it
  const floorProductIds = useTracker(() => {
    Meteor.subscribe("productRecords");
    if (!currentFloorMap) return new Set();
    const unitIds = StorageUnits.find({ floorMapId: currentFloorMap._id }, { fields: { _id: 1 } })
      .fetch()
      .map((unit) => unit._id);
    const locationIds = StorageLocations.find(
      { storageUnitId: { $in: unitIds } },
      { fields: { _id: 1 } },
    )
      .fetch()
      .map((location) => location._id);
    return new Set(
      ProductRecords.find({ locationId: { $in: locationIds }, quantity: { $gt: 0 } })
        .fetch()
        .map((record) => record.productId),
    );
  }, [currentFloorMap?._id]);
  const floorProducts = products.filter((product) => floorProductIds.has(product._id));
  // Route planning (picking a start point) is a view mode feature; route mode clicks edit walkways
  const isViewMode = canvasMode === CANVAS_MODES.VIEW;
  // Switching maps remounts the editor and would throw away unsaved layout edits
  const isMapSwitchLocked = (isCanvasEditMode && canManage) || isSavingLayout;

  // Track whether the mobile layout applies
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Mobile: move focus into the editor sheet when it opens, and onto the stock sheet's close button
  useEffect(() => {
    if (isMobile && mobilePanelOpen) panelRef.current?.querySelector("button")?.focus();
  }, [isMobile, mobilePanelOpen]);

  useEffect(() => {
    if (isMobile && isStockPanelOpen)
      document.querySelector(".floor-map-stock-wrap .panel-close-btn")?.focus();
  }, [isMobile, isStockPanelOpen]);

  // Mobile: keep Tab inside the expanded editor sheet, and let Escape close the sheets
  useEffect(() => {
    if (!isMobile) return;
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
      // Modals handle Escape themselves
      const isModalOpen =
        isCreateShapeOpen ||
        isFloorMapSettingsOpen ||
        isEditorSettingsOpen ||
        editingProductNode ||
        unitPendingDelete ||
        shapePendingDelete;
      if (isModalOpen) return;
      if (mobilePanelOpen) closeMobilePanel();
      else if (isStockPanelOpen) closeStockPanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Keep the URL on the floor map actually being shown (e.g. /floor-map or a deleted map's id)
  useEffect(() => {
    if (locationsReady && currentFloorMap && floorMapId !== currentFloorMap._id) {
      navigate(`/floor-map/${currentFloorMap._id}`, { replace: true });
    }
  }, [locationsReady, currentFloorMap, floorMapId, navigate]);

  // A different floor or floor size needs a new route and starting point.
  useEffect(() => {
    setSelectedProductIds([]);
    setStartingPoint(null);
    setIsSelectingStart(false);
    setIsRouteModalOpen(false);
    setPlannedRoute(null);
    setRouteError(null);
  }, [currentFloorMap?._id, floorSize.width, floorSize.height]);

  useEffect(() => {
    if (!isSelectingStart && !isRouteModalOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsSelectingStart(false);
        setIsRouteModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSelectingStart, isRouteModalOpen]);

  const handleSelectStart = () => {
    // Close modal so the user can interact with the canvas
    setIsRouteModalOpen(false);

    setSelectedStorageUnitId(null);
    setSelectedUnit(null);
    setIsStockPanelOpen(false);
    setTooltip(null);

    // Start selecting a point on the map
    setIsSelectingStart(true);
  };

  const handleStartingPointSelect = (point) => {
    // Save the point selected on the canvas
    setStartingPoint(point);

    // Stop selecting
    setIsSelectingStart(false);

    // Open route planning modal
    setIsRouteModalOpen(true);
  };

  const handleGenerateRoute = async () => {
    if (!currentFloorMap || !startingPoint || selectedProductIds.length === 0) return;
    setIsGeneratingRoute(true);
    setRouteError(null);
    try {
      const route = await Meteor.callAsync("floorMapRoutes.generate", {
        floorMapId: currentFloorMap._id,
        start: startingPoint,
        productIds: selectedProductIds,
      });
      if (route.stops.length === 0) {
        setPlannedRoute(null);
        setRouteError(
          "None of the selected products can be reached from the walkways on this floor.",
        );
        return;
      }
      setPlannedRoute(route);
      setIsRouteModalOpen(false);
    } catch (error) {
      setRouteError(error.reason || error.message || "Could not generate a route.");
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const productName = (productId) =>
    products.find((product) => product._id === productId)?.name ?? "Unknown product";

  const handleAddProduct = (productId) => {
    if (!floorProducts.some((product) => product._id === productId)) return;
    setSelectedProductIds((previous) =>
      previous.includes(productId) ? previous : [...previous, productId],
    );
  };

  // Edit sidebar header controls: collapse on desktop, expand / close the sheet on mobile
  const editSidebarHeaderControls = isMobile ? (
    <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
      <button
        type="button"
        className="floor-map-icon-button"
        onClick={() => setMobileExpanded(!mobileExpanded)}
        aria-label={mobileExpanded ? "Use compact editor panel" : "Expand editor panel"}
        aria-expanded={mobileExpanded}
        title={mobileExpanded ? "Use compact panel" : "Expand panel"}
      >
        <FloorMapIcon name={mobileExpanded ? "collapse" : "expand"} />
      </button>
      <button
        type="button"
        className="floor-map-icon-button"
        onClick={closeMobilePanel}
        aria-label="Close editor panel"
        title="Close editor panel"
      >
        <FloorMapIcon name="close" />
      </button>
    </span>
  ) : (
    <SidebarCollapseButton onClick={() => setSidebarOpen(false)} />
  );

  // The edit sidebar fills the sheet on mobile instead of using the fixed desktop width
  const mobileSheetPanelStyle = {
    ...sidebarStyles.panel,
    width: "100%",
    minWidth: 0,
    maxWidth: "none",
    height: "100%",
  };

  const editSidebarPanel = (
    <div style={isMobile ? mobileSheetPanelStyle : sidebarStyles.panel}>
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
          {editSidebarHeaderControls}
        </div>
      ) : (
        <div style={sidebarStyles.header}>
          {EDIT_SIDEBAR_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRightPanelTab(tab.key)}
              style={sidebarStyles.tab(rightPanelTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
          {editSidebarHeaderControls}
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
              mobile={isMobile}
            />
          </div>
        ) : selectedUnit ? (
          <>
            {/* SETTINGS for the selected storage unit */}
            <div style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}>
              <UnitDetailsPanel
                unit={selectedUnit}
                onRename={(name) => updateSelectedUnit({ name })}
                onColourChange={(fill) => updateSelectedUnit({ fill })}
              />
            </div>
            <div style={{ height: "1px", background: COLOURS.CARD_BORDER }} />
            <div style={{ padding: "12px", boxSizing: "border-box", overflow: "hidden" }}>
              {selectedUnit._id ? (
                <StorageLocationPanel storageUnitId={selectedStorageUnitId} />
              ) : (
                <p className="floor-map-panel-empty">
                  Save the layout before adding storage locations to this unit.
                </p>
              )}
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
                  No storage units on this floor map yet. Drag a shape from the Templates tab onto
                  the canvas to create one.
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
                onEditShape={handleEditShape}
                onDeleteShape={handleDeleteShape}
                mobile={isMobile}
                onShapeAdded={(unit) => {
                  setSelectedStorageUnitId(unit.id);
                  setSelectedUnit(unit);
                  setMobileExpanded(false);
                }}
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
      <div style={statusBarStyles.bar}>
        <div style={statusBarStyles.group}>
          {sites.length > 0 ? (
            <>
              {/* WAREHOUSE (SITE) SELECT */}
              <label style={statusBarStyles.selectPill}>
                <span style={statusBarStyles.selectLabel}>Site</span>
                <select
                  value={currentSite?._id ?? ""}
                  onChange={(e) => {
                    const targetSiteId = e.target.value;
                    const targetMap = floorMaps.find((f) => f.siteId === targetSiteId);
                    if (targetMap) navigate(`/floor-map/${targetMap._id}`);
                  }}
                  aria-label="Select site"
                  disabled={isMapSwitchLocked}
                  title={isMapSwitchLocked ? "Finish editing to switch maps" : undefined}
                  style={statusBarStyles.select}
                >
                  {sites.map((site) => (
                    <option key={site._id} value={site._id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* FLOOR MAP SELECT - only shown when the selected site has more than one floor map */}
              {currentSite && siteFloorMaps.length > 1 && (
                <label style={statusBarStyles.selectPill}>
                  <span style={statusBarStyles.selectLabel}>Floor Map</span>
                  <select
                    value={currentFloorMap?._id ?? ""}
                    onChange={(e) => navigate(`/floor-map/${e.target.value}`)}
                    aria-label="Select floor map"
                    disabled={isMapSwitchLocked}
                    title={isMapSwitchLocked ? "Finish editing to switch maps" : undefined}
                    style={statusBarStyles.select}
                  >
                    {siteFloorMaps.map((fm) => (
                      <option key={fm._id} value={fm._id}>
                        {fm.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : (
            <span style={statusBarStyles.selectPill}>
              <span style={statusBarStyles.selectLabel}>Floor Map</span>
              <span style={statusBarStyles.select}>{currentFloorMap?.name ?? "Floor Map"}</span>
            </span>
          )}

          {/* SAVE LAYOUT */}
          {isCanvasEditMode && canManage && (
            <SaveIconButton
              label="layout"
              hasUnsavedChanges={isLayoutDirty}
              isSaving={isSavingLayout}
              onSave={() => saveLayoutWithDialog()}
            />
          )}

          {/* EDITOR TOOLS - mobile only, opens the editor sheet */}
          {isMobile && isCanvasEditMode && canManage && (
            <button
              ref={editorTriggerRef}
              type="button"
              onClick={() => setMobilePanelOpen(true)}
              aria-label="Editor tools"
              title="Editor tools"
              aria-expanded={mobilePanelOpen}
              aria-controls="floor-map-editor-wrap"
              style={statusBarStyles.iconButton(mobilePanelOpen)}
            >
              <FloorMapIcon name="panel" size={14} />
            </button>
          )}

          {/* SAVE ROUTE */}
          {canvasMode === CANVAS_MODES.ROUTE && canManage && (
            <SaveIconButton
              label="route"
              hasUnsavedChanges={isRouteDirty}
              isSaving={isSavingRoute}
              onSave={handleSaveRoute}
            />
          )}

          {/* PLAN ROUTE - highlighted while picking a starting point */}
          {isViewMode && (
            <button
              type="button"
              onClick={handleSelectStart}
              disabled={!mapReady}
              aria-label="Plan route"
              title="Plan route"
              style={{
                ...statusBarStyles.iconButton(isSelectingStart || isRouteModalOpen),
                opacity: mapReady ? 1 : 0.5,
                cursor: mapReady ? "pointer" : "not-allowed",
              }}
            >
              <RouteIcon size={14} />
            </button>
          )}
        </div>

        <div style={statusBarStyles.group}>
          {/* MODE SWITCHER */}
          <div role="group" aria-label="Floor map mode" style={statusBarStyles.modeGroup}>
            {MODE_OPTIONS.map(({ mode, label, requiresManage }) => {
              const isActive = canvasMode === mode;
              const isDisabled = (requiresManage && !canManage) || isSavingLayout;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleCanvasModeChange(mode)}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  style={statusBarStyles.modeButton(isActive, isDisabled)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* DETAILED VIEW - opens the floor map detail page */}
          {isViewMode && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  currentFloorMap ? `/floor-map/${currentFloorMap._id}/detail` : "/floor-map",
                )
              }
              aria-label="Detailed view"
              title="Detailed view"
              style={statusBarStyles.iconButton()}
            >
              <FloorMapIcon name="units" size={14} />
            </button>
          )}

          {/* EXPORT AS PNG */}
          <button
            type="button"
            onClick={() => canvasRef.current?.exportPng()}
            aria-label="Export as PNG"
            title="Export as PNG"
            style={statusBarStyles.iconButton()}
          >
            <DownloadIcon size={14} />
          </button>

          {/* EDITOR SETTINGS - available in every mode */}
          <button
            type="button"
            onClick={() => setEditorSettingsOpen(true)}
            aria-label="Editor settings"
            title="Editor settings"
            style={statusBarStyles.iconButton(isEditorSettingsOpen)}
          >
            <SettingsIcon size={14} />
          </button>

          {/* FLOOR MAP SETTINGS - visible in every mode, editable only in edit mode */}
          <button
            type="button"
            onClick={() => setFloorMapSettingsOpen(true)}
            aria-label="Floor map settings"
            title="Floor map settings"
            style={statusBarStyles.iconButton(isFloorMapSettingsOpen)}
          >
            <MapIcon size={14} />
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
        {isSelectingStart && isViewMode && (
          <div className="map-route-prompt" role="status">
            <span>Click a point on the floor map to set your starting point.</span>

            <button type="button" onClick={() => setIsSelectingStart(false)}>
              Cancel
            </button>
          </div>
        )}

        {/* PLANNED ROUTE SUMMARY */}
        {plannedRoute && isViewMode && !isSelectingStart && (
          <div className="map-route-prompt" role="status">
            <span>
              {plannedRoute.stops.length} {plannedRoute.stops.length === 1 ? "stop" : "stops"} ·{" "}
              {plannedRoute.distance.toFixed(1)} m
              {plannedRoute.unreachableProductIds.length > 0 &&
                ` · Couldn't reach: ${plannedRoute.unreachableProductIds.map(productName).join(", ")}`}
            </span>

            <button type="button" onClick={() => setPlannedRoute(null)}>
              Clear
            </button>
          </div>
        )}

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
              key={floorMapId ?? "default"}
              style={{ display: "block", width: "100%", height: "100%" }}
              selectedStorageUnitId={selectedStorageUnitId}
              setSelectedStorageUnitId={handleUnitSelect}
              setTooltip={isMobile ? undefined : setTooltip}
              fitInsetRight={viewFitInsetRight}
              lowStockByUnitId={lowStockByUnitId}
              // Only mark the start while planning in the modal or when a route is drawn
              startingPoint={plannedRoute || isRouteModalOpen ? startingPoint : null}
              plannedRoute={plannedRoute}
              isSelectingStart={isSelectingStart && mapReady && isViewMode}
              onStartingPointSelect={handleStartingPointSelect}
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
          {selectedUnit &&
            isStockPanelOpen &&
            canvasMode === CANVAS_MODES.VIEW &&
            (isMobile ? (
              <div
                className="floor-map-stock-wrap"
                role="dialog"
                aria-modal="true"
                aria-label={`Stocktake for ${selectedUnit.name}`}
              >
                <UnitStocktakePanel
                  unit={selectedUnit}
                  canStocktake={canStocktake}
                  onClose={closeStockPanel}
                />
              </div>
            ) : (
              <UnitStocktakePanel
                unit={selectedUnit}
                canStocktake={canStocktake}
                onClose={closeStockPanel}
              />
            ))}

          {/* EDIT MODE SIDEBAR - only accessible to admins/owners (a bottom sheet on mobile) */}
          {isCanvasEditMode && canManage && !isMobile && (
            <>
              {isSidebarOpen ? (
                editSidebarPanel
              ) : (
                <CollapsedSidebar onExpand={() => setSidebarOpen(true)} />
              )}
            </>
          )}

          {/* ROUTE MODE SIDEBAR */}
          {canvasMode === CANVAS_MODES.ROUTE &&
            canManage &&
            (isSidebarOpen ? (
              <RouteToolbar
                activeTool={activeRouteTool}
                onSelectTool={selectRouteTool}
                onCollapse={() => setSidebarOpen(false)}
              />
            ) : (
              <CollapsedSidebar onExpand={() => setSidebarOpen(true)} />
            ))}
        </div>
        {/* end right column */}
      </div>

      {/* MOBILE EDITOR SHEET */}
      {isMobile && isCanvasEditMode && canManage && (
        <div
          id="floor-map-editor-wrap"
          ref={panelRef}
          className={`floor-map-editor-wrap${mobilePanelOpen ? " is-mobile-open" : ""}${mobileExpanded ? " is-expanded" : ""}`}
          role="dialog"
          aria-modal={mobileExpanded ? "true" : undefined}
          aria-label="Layout editor"
        >
          {editSidebarPanel}
        </div>
      )}
      {isMobile && isCanvasEditMode && canManage && mobilePanelOpen && mobileExpanded && (
        <button
          type="button"
          className="floor-map-sheet-scrim"
          onClick={closeMobilePanel}
          aria-label="Close editor panel"
        />
      )}

      {/* HOVER TOOLTIP */}
      <MapTooltip tooltip={tooltip} />

      {/* FLOOR MAP SETTINGS MODAL */}
      {isFloorMapSettingsOpen && (
        <FloorMapSettingsModal
          floorSize={floorSize}
          gridInterval={canvasSettings.gridInterval}
          onSave={handleFloorMapSettingsSave}
          onClose={() => setFloorMapSettingsOpen(false)}
          // Changes are only saved via Save Layout, which exists in edit mode
          isReadOnly={!(isCanvasEditMode && canManage)}
          readOnlyMessage={
            canManage
              ? "Switch to Edit mode to change the floor size."
              : "Only admins and owners can change the floor size."
          }
        />
      )}

      {/* SAVING LAYOUT - blocks the page while the layout saves */}
      <dialog
        ref={savingDialogRef}
        className="floor-map-saving-dialog"
        aria-labelledby="saving-layout-message"
        onCancel={(event) => event.preventDefault()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <p id="saving-layout-message" role="status">
          Saving layout…
        </p>
      </dialog>

      {/* DELETE UNIT - move its storage locations to other units first */}
      {unitPendingDelete && (
        <DeleteUnitModal
          unit={unitPendingDelete}
          excludedUnitIds={unitIdsStagedForRemoval}
          onConfirm={handleConfirmDeleteWithReassign}
          onClose={() => setUnitPendingDelete(null)}
        />
      )}

      {/* DELETE SHAPE - move the units using it to another shape first */}
      {shapePendingDelete && (
        <DeleteShapeModal
          shape={shapePendingDelete}
          onConfirm={handleConfirmDeleteShapeWithReassign}
          onClose={() => setShapePendingDelete(null)}
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

      {/* ROUTE PLANNING MODAL */}
      {isRouteModalOpen && isViewMode && (
        <div
          className="map-route-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsRouteModalOpen(false);
            }
          }}
        >
          <div
            className="map-route-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-route-modal-title"
            style={{
              background: COLOURS.CARD_BG,
              color: COLOURS.TEXT_PRIMARY,
              border: `1px solid ${COLOURS.CARD_BORDER}`,
            }}
          >
            <div className="map-route-modal__header">
              <h2 id="map-route-modal-title">Plan Route</h2>

              <button
                type="button"
                autoFocus
                className="map-route-modal__close"
                aria-label="Close route planner"
                onClick={() => setIsRouteModalOpen(false)}
              >
                ×
              </button>
            </div>

            <MapRouteInputs
              key={currentFloorMap?._id ?? "default"}
              products={floorProducts}
              productsReady={productsReady}
              selectedProductIds={selectedProductIds}
              onAddProduct={handleAddProduct}
              onRemoveProduct={(productId) =>
                setSelectedProductIds((previous) => previous.filter((id) => id !== productId))
              }
              startingPoint={startingPoint}
              isSelectingStart={isSelectingStart && mapReady}
              onSelectStart={handleSelectStart}
              onCancelSelectStart={() => setIsSelectingStart(false)}
              onClearStart={() => {
                setStartingPoint(null);
                handleSelectStart();
              }}
              mapReady={mapReady}
              onGenerateRoute={handleGenerateRoute}
              isGeneratingRoute={isGeneratingRoute}
              routeError={routeError}
            />
          </div>
        </div>
      )}
      {/* PRODUCT NODE STORAGE LOCATIONS MODAL - on placement, or when a product node is clicked */}
      {editingProductNodeData && (
        <ProductNodeLocationsModal
          key={editingProductNode.nodeId}
          node={editingProductNodeData}
          isNew={editingProductNode.isNew}
          onConfirm={confirmProductNodeLocations}
          onCancel={cancelProductNodeEdit}
        />
      )}
    </div>
  );
}

export function FloorMapPage() {
  const { floorMapId } = useParams();
  const [searchParams] = useSearchParams();
  // Owned here (outside the remounted EditorProvider) so the current mode
  // persists when switching between floor maps / warehouses.
  const [canvasMode, setCanvasMode] = useState(() =>
    searchParams.get("edit") === "1" ? CANVAS_MODES.EDIT : CANVAS_MODES.VIEW,
  );
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
