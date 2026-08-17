import { useMemo } from "react";
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
import "./DashboardPage.css";
import "../Global.css";

function formatUpdatedAt(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DashboardPage() {
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

  return (
    <div className="dashboard-page-container">
      <div className="breadcrumb">
        <span className="breadcrumb-current">Dashboard</span>
      </div>
      <h1 className="dashboard-page-heading">Hello, {username || "User"}</h1>
      <p className="dashboard-page-subheading">Here&apos;s what&apos;s stocked.</p>

      <div className="dashboard-grid">
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
              <Link
                key={item._id}
                to={`/inventory/${item._id}`}
                className="dashboard-low-stock-row"
              >
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
              const updatedAtDateTime = updatedAtLabel
                ? new Date(item.updatedAt).toISOString()
                : null;

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
      </div>
    </div>
  );
}
