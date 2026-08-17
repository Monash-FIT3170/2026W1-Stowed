import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { getInventorySnapshot } from "../../api/inventorySnapshot";
import { FloorMaps, Sites, StorageLocations, StorageUnits } from "../../api/locations/collections";
import {
  describeStocktakeTiming,
  getStocktakeAlerts,
  STOCKTAKE_STATUS,
} from "../../api/locations/stocktake";
import { Products } from "../../api/products/collections";
import {
  getLowStockProductsByUrgency,
  getRecentlyUpdatedProducts,
} from "../../api/products/filters";
import { hasClientPermission } from "../../api/userMethods";
import { DashboardWidget } from "../components/DashboardWidget";
import {
  DASHBOARD_WIDGET_CATALOG,
  isDefaultDashboardPreferences,
  normalizeDashboardPreferences,
  reorderDashboardWidgets,
} from "../dashboardPreferences";
import "./DashboardPage.css";
import "../Global.css";

const DASHBOARD_PREFERENCES_KEY_PREFIX = "stowed.dashboard.v1";

function getDashboardPreferencesKey(userId) {
  return `${DASHBOARD_PREFERENCES_KEY_PREFIX}.${userId || "anonymous"}`;
}

function loadDashboardPreferences(userId) {
  if (typeof window === "undefined") return normalizeDashboardPreferences(null);

  try {
    const savedValue = window.localStorage.getItem(getDashboardPreferencesKey(userId));
    return normalizeDashboardPreferences(savedValue ? JSON.parse(savedValue) : null);
  } catch {
    return normalizeDashboardPreferences(null);
  }
}

function saveDashboardPreferences(userId, preferences) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getDashboardPreferencesKey(userId),
      JSON.stringify(normalizeDashboardPreferences(preferences)),
    );
  } catch {
    // Dashboard customization should stay usable if storage is unavailable.
  }
}

function formatUpdatedAt(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InventorySnapshotWidget({ snapshotMetrics, snapshotLoading, snapshotEmpty }) {
  return (
    <DashboardWidget
      title="Inventory snapshot"
      subtitle={snapshotLoading ? undefined : "Current inventory footprint"}
      isLoading={snapshotLoading}
      loadingLabel="Loading inventory snapshot…"
      isEmpty={snapshotEmpty}
      emptyState={
        <div className="dashboard-snapshot-empty">
          <strong>No inventory setup yet</strong>
          <span>Products and storage locations will appear here once added.</span>
        </div>
      }
    >
      <div className="dashboard-snapshot-grid">
        {snapshotMetrics.map((metric) => (
          <Link
            key={metric.label}
            to={metric.to}
            className={`dashboard-snapshot-metric dashboard-snapshot-metric-${metric.tone}`}
            aria-label={`${metric.label}: ${metric.value.toLocaleString()}`}
          >
            <strong>{metric.value.toLocaleString()}</strong>
            <span>{metric.label}</span>
          </Link>
        ))}
      </div>
    </DashboardWidget>
  );
}

function StocktakeAttentionWidget({
  canViewAlerts,
  locationsLoading,
  overdueStocktakes,
  stocktakePreview,
}) {
  return (
    <DashboardWidget
      title="Stocktake attention"
      subtitle={
        locationsLoading
          ? undefined
          : overdueStocktakes.length > 0
            ? `${overdueStocktakes.length} location${overdueStocktakes.length === 1 ? "" : "s"} overdue`
            : "Stocktake status across your locations"
      }
      action={
        canViewAlerts ? (
          <Link to="/alerts" className="dashboard-action-link">
            View all →
          </Link>
        ) : null
      }
      isLoading={locationsLoading}
      loadingLabel="Loading stocktake status…"
      isEmpty={overdueStocktakes.length === 0}
      emptyState={
        <div className="dashboard-stocktake-empty">
          <strong>All locations are up to date</strong>
          <span>No stocktakes currently overdue.</span>
        </div>
      }
    >
      <div className="dashboard-stocktake-list">
        {stocktakePreview.map((alert) => (
          <Link
            key={alert.location._id}
            to={`/locations/${alert.location._id}`}
            className="dashboard-stocktake-row"
          >
            <span className="dashboard-stocktake-location">
              <strong>{alert.location.name || "Unnamed location"}</strong>
              <span>{alert.path || "Unlinked location"}</span>
            </span>
            <span className="dashboard-stocktake-timing">
              {describeStocktakeTiming(alert.daysUntilDue)}
            </span>
          </Link>
        ))}
      </div>
    </DashboardWidget>
  );
}

function LowStockWidget({ lowStockCount, lowStockPreview, productsLoading }) {
  return (
    <DashboardWidget
      title="Low stock"
      subtitle={
        productsLoading
          ? undefined
          : lowStockCount > 0
            ? `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} need${lowStockCount === 1 ? "s" : ""} attention`
            : "Stock levels across your inventory"
      }
      action={
        <Link to="/inventory/list?filter=low-stock" className="dashboard-action-link">
          View inventory →
        </Link>
      }
      isLoading={productsLoading}
      loadingLabel="Loading stock levels…"
      isEmpty={lowStockCount === 0}
      emptyState={
        <div className="dashboard-low-stock-empty">
          <strong>Stock levels look good</strong>
          <span>No items are currently below their minimum level.</span>
        </div>
      }
    >
      <div className="dashboard-low-stock-list">
        {lowStockPreview.map((item) => (
          <Link key={item._id} to={`/inventory/${item._id}`} className="dashboard-low-stock-row">
            <span className="dashboard-low-stock-product">
              <strong>{item.name}</strong>
              {item.sku && <span>{item.sku}</span>}
            </span>
            <span className="dashboard-low-stock-meta">
              <strong>{item.totalQuantity} remaining</strong>
              <span>Min. {item.reorderAt}</span>
            </span>
          </Link>
        ))}
      </div>
    </DashboardWidget>
  );
}

function RecentlyUpdatedWidget({ productsLoading, recentItems, totalItems }) {
  return (
    <DashboardWidget
      title="Recently updated"
      subtitle={
        productsLoading ? undefined : `${recentItems.length} of ${totalItems} products shown`
      }
      action={
        <Link to="/inventory/list" className="dashboard-action-link">
          View inventory →
        </Link>
      }
      isLoading={productsLoading}
      loadingLabel="Loading recent inventory…"
      isEmpty={recentItems.length === 0}
      emptyState={
        <div className="dashboard-recent-empty">
          <strong>No inventory activity yet</strong>
          <span>Products will appear here after they are added.</span>
        </div>
      }
    >
      <div className="dashboard-recent-list">
        {recentItems.map((item) => {
          const updatedAtLabel = formatUpdatedAt(item.updatedAt);
          const updatedAtDateTime = updatedAtLabel ? new Date(item.updatedAt).toISOString() : null;

          return (
            <Link key={item._id} to={`/inventory/${item._id}`} className="dashboard-recent-row">
              <span className="dashboard-recent-product">
                <strong>{item.name}</strong>
                <span>{item.totalQuantity} in stock</span>
              </span>
              {updatedAtLabel && (
                <time className="dashboard-recent-time" dateTime={updatedAtDateTime}>
                  {updatedAtLabel}
                </time>
              )}
            </Link>
          );
        })}
      </div>
    </DashboardWidget>
  );
}

export function DashboardPage() {
  const preferenceOwnerId = Meteor.userId() || "anonymous";
  const [preferences, setPreferences] = useState(() => loadDashboardPreferences(preferenceOwnerId));
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [customizationStatus, setCustomizationStatus] = useState("");
  const {
    items,
    productsLoading,
    locationsLoading,
    storageLocations,
    storageUnits,
    floorMaps,
    sites,
    username,
    role,
  } = useTracker(() => {
    const productsHandle = Meteor.subscribe("products");
    const locationsHandle = Meteor.subscribe("locations.all");
    return {
      items: Products.find().fetch(),
      productsLoading: !productsHandle.ready(),
      locationsLoading: !locationsHandle.ready(),
      storageLocations: StorageLocations.find().fetch(),
      storageUnits: StorageUnits.find().fetch(),
      floorMaps: FloorMaps.find().fetch(),
      sites: Sites.find().fetch(),
      username: Meteor.user()?.profile?.username,
      role: Meteor.user()?.profile?.role,
    };
  }, []);

  useEffect(() => {
    saveDashboardPreferences(preferenceOwnerId, preferences);
  }, [preferenceOwnerId, preferences]);

  const inventorySnapshot = useMemo(
    () => getInventorySnapshot({ products: items, storageLocations, storageUnits }),
    [items, storageLocations, storageUnits],
  );
  const totalItems = inventorySnapshot.productCount;
  const lowStockItems = useMemo(() => getLowStockProductsByUrgency(items), [items]);
  const lowStockCount = lowStockItems.length;
  const lowStockPreview = lowStockItems.slice(0, 4);
  const recentItems = useMemo(() => getRecentlyUpdatedProducts(items, 5), [items]);
  const overdueStocktakes = useMemo(
    () =>
      getStocktakeAlerts({
        storageLocations,
        storageUnits,
        floorMaps,
        sites,
        statuses: [STOCKTAKE_STATUS.OVERDUE],
      }),
    [storageLocations, storageUnits, floorMaps, sites],
  );
  const stocktakePreview = overdueStocktakes.slice(0, 4);
  const canViewAlerts = hasClientPermission(role, "route:/alerts");
  const canCreateProducts = hasClientPermission(role, "products.create");
  const snapshotLoading = productsLoading || locationsLoading;
  const snapshotEmpty =
    inventorySnapshot.productCount === 0 &&
    inventorySnapshot.storageLocationCount === 0 &&
    inventorySnapshot.storageUnitCount === 0;
  const snapshotMetrics = [
    {
      label: "Units on hand",
      value: inventorySnapshot.unitsOnHand,
      to: "/inventory/list",
      tone: "green",
    },
    {
      label: "Products",
      value: inventorySnapshot.productCount,
      to: "/inventory/list",
      tone: "orange",
    },
    {
      label: "Storage locations",
      value: inventorySnapshot.storageLocationCount,
      to: "/locations",
      tone: "yellow",
    },
    {
      label: "Storage units",
      value: inventorySnapshot.storageUnitCount,
      to: "/floor-map",
      tone: "neutral",
    },
  ];

  const visibleWidgetIds = preferences.order.filter(
    (widgetId) => !preferences.hidden.includes(widgetId),
  );
  const widgetLabels = Object.fromEntries(
    DASHBOARD_WIDGET_CATALOG.map((widget) => [widget.id, widget.label]),
  );
  const widgetsById = {
    snapshot: (
      <InventorySnapshotWidget
        snapshotMetrics={snapshotMetrics}
        snapshotLoading={snapshotLoading}
        snapshotEmpty={snapshotEmpty}
      />
    ),
    stocktake: (
      <StocktakeAttentionWidget
        canViewAlerts={canViewAlerts}
        locationsLoading={locationsLoading}
        overdueStocktakes={overdueStocktakes}
        stocktakePreview={stocktakePreview}
      />
    ),
    "low-stock": (
      <LowStockWidget
        lowStockCount={lowStockCount}
        lowStockPreview={lowStockPreview}
        productsLoading={productsLoading}
      />
    ),
    recent: (
      <RecentlyUpdatedWidget
        productsLoading={productsLoading}
        recentItems={recentItems}
        totalItems={totalItems}
      />
    ),
  };

  function moveWidget(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const nextOrder = reorderDashboardWidgets(preferences.order, sourceId, targetId);
    const nextVisibleOrder = nextOrder.filter((widgetId) => !preferences.hidden.includes(widgetId));
    setPreferences((current) => ({ ...current, order: nextOrder }));
    setCustomizationStatus(
      `${widgetLabels[sourceId]} moved to position ${nextVisibleOrder.indexOf(sourceId) + 1}.`,
    );
  }

  function moveWidgetByStep(widgetId, direction) {
    const currentIndex = visibleWidgetIds.indexOf(widgetId);
    const targetId = visibleWidgetIds[currentIndex + direction];
    if (targetId) moveWidget(widgetId, targetId);
  }

  function setWidgetVisible(widgetId, shouldShow) {
    setPreferences((current) => ({
      ...current,
      hidden: shouldShow
        ? current.hidden.filter((hiddenId) => hiddenId !== widgetId)
        : [...new Set([...current.hidden, widgetId])],
    }));
    setCustomizationStatus(
      `${widgetLabels[widgetId]} ${shouldShow ? "shown" : "hidden"} on the dashboard.`,
    );
  }

  function resetDashboard() {
    setPreferences(normalizeDashboardPreferences(null));
    setCustomizationStatus("Default dashboard layout restored.");
  }

  function handleDragStart(event, widgetId) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", widgetId);
    setDraggedWidgetId(widgetId);
    setDropTargetId(widgetId);
  }

  function handleDrop(event, targetId) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggedWidgetId;
    moveWidget(sourceId, targetId);
    setDraggedWidgetId(null);
    setDropTargetId(null);
  }

  function finishDrag() {
    setDraggedWidgetId(null);
    setDropTargetId(null);
  }

  return (
    <div className="dashboard-page-container">
      <div className="breadcrumb">
        <span className="breadcrumb-current">Dashboard</span>
      </div>
      <div className="dashboard-page-hero">
        <div>
          <h1 className="dashboard-page-heading">Hello, {username || "User"}</h1>
          <p className="dashboard-page-subheading">Here&apos;s what&apos;s stocked.</p>
        </div>
        <div className="dashboard-page-actions" role="group" aria-label="Dashboard actions">
          {canCreateProducts && (
            <Link
              to="/inventory/new"
              className="dashboard-quick-action dashboard-quick-action-primary"
            >
              + Add product
            </Link>
          )}
          <Link to="/inventory/list" className="dashboard-quick-action">
            Browse inventory
          </Link>
          <Link to="/locations" className="dashboard-quick-action">
            Find a location
          </Link>
          <button
            type="button"
            className={`dashboard-customize-button${isCustomizing ? " is-active" : ""}`}
            aria-expanded={isCustomizing}
            aria-controls="dashboard-customizer"
            onClick={() => {
              setIsCustomizing((current) => !current);
              finishDrag();
            }}
          >
            {isCustomizing ? "Done" : "Customize"}
            {preferences.hidden.length > 0 && (
              <span
                className="dashboard-hidden-count"
                aria-label={`${preferences.hidden.length} hidden widgets`}
              >
                {preferences.hidden.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {isCustomizing && (
        <section
          id="dashboard-customizer"
          className="dashboard-customizer"
          aria-labelledby="dashboard-customizer-title"
        >
          <div className="dashboard-customizer-copy">
            <h2 id="dashboard-customizer-title">Make this dashboard yours</h2>
            <p>
              Drag cards into place, use the arrow controls, or hide anything you do not need.
              Changes save automatically.
            </p>
          </div>
          <div
            className="dashboard-customizer-options"
            role="group"
            aria-label="Visible dashboard widgets"
          >
            {DASHBOARD_WIDGET_CATALOG.map((widget) => {
              const isVisible = !preferences.hidden.includes(widget.id);
              return (
                <label key={widget.id} className="dashboard-widget-toggle">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(event) => setWidgetVisible(widget.id, event.target.checked)}
                  />
                  <span>{widget.label}</span>
                </label>
              );
            })}
          </div>
          <div className="dashboard-customizer-footer">
            <p className="dashboard-customization-status" role="status" aria-live="polite">
              {customizationStatus}
            </p>
            <button
              type="button"
              className="dashboard-reset-button"
              onClick={resetDashboard}
              disabled={isDefaultDashboardPreferences(preferences)}
            >
              Reset to default
            </button>
          </div>
        </section>
      )}

      {visibleWidgetIds.length > 0 ? (
        <div className={`dashboard-grid${isCustomizing ? " is-customizing" : ""}`}>
          {visibleWidgetIds.map((widgetId, index) => (
            <div
              key={widgetId}
              className={`dashboard-widget-shell${draggedWidgetId === widgetId ? " is-dragging" : ""}${dropTargetId === widgetId && draggedWidgetId !== widgetId ? " is-drop-target" : ""}`}
              onDragEnter={() => {
                if (draggedWidgetId && draggedWidgetId !== widgetId) setDropTargetId(widgetId);
              }}
              onDragOver={(event) => {
                if (draggedWidgetId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => handleDrop(event, widgetId)}
            >
              {isCustomizing && (
                <div className="dashboard-widget-edit-bar">
                  <button
                    type="button"
                    className="dashboard-drag-handle"
                    draggable
                    onDragStart={(event) => handleDragStart(event, widgetId)}
                    onDragEnd={finishDrag}
                    aria-label={`Drag ${widgetLabels[widgetId]} to reorder`}
                    title="Drag to reorder"
                  >
                    <span aria-hidden="true">⠿</span>
                  </button>
                  <span className="dashboard-widget-position">
                    {index + 1} of {visibleWidgetIds.length}
                  </span>
                  <div className="dashboard-widget-edit-actions">
                    <button
                      type="button"
                      onClick={() => moveWidgetByStep(widgetId, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${widgetLabels[widgetId]} earlier`}
                      title="Move earlier"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWidgetByStep(widgetId, 1)}
                      disabled={index === visibleWidgetIds.length - 1}
                      aria-label={`Move ${widgetLabels[widgetId]} later`}
                      title="Move later"
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => setWidgetVisible(widgetId, false)}>
                      Hide
                    </button>
                  </div>
                </div>
              )}
              {widgetsById[widgetId]}
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-cleared-state">
          <strong>Your dashboard is clear</strong>
          <span>Turn on a widget whenever you want a little more context here.</span>
          {!isCustomizing && (
            <button type="button" onClick={() => setIsCustomizing(true)}>
              Customize dashboard
            </button>
          )}
        </div>
      )}
    </div>
  );
}
