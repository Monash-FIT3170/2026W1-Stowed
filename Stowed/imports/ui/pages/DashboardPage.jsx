import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { FloorMaps, Sites, StorageLocations, StorageUnits } from "../../api/locations/collections";
import {
  describeStocktakeTiming,
  getStocktakeAlerts,
  STOCKTAKE_STATUS,
} from "../../api/locations/stocktake";
import { Products } from "../../api/products/collections";
import { getLowStockProductsByUrgency } from "../../api/products/filters";
import { hasClientPermission } from "../../api/userMethods";
import { DashboardWidget } from "../components/DashboardWidget";
import { ProductThumbnail } from "../components/ProductThumbnail";
import { StatusBadge } from "../components/StatusBadge";
import "./DashboardPage.css";
import "../Global.css";

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

  const totalItems = items.length;
  const lowStockItems = useMemo(() => getLowStockProductsByUrgency(items), [items]);
  const lowStockCount = lowStockItems.length;
  const lowStockPreview = lowStockItems.slice(0, 4);
  const totalValue = items.reduce(
    (sum, item) => sum + (item.unitCost * item.totalQuantity || 0),
    0,
  );
  const recentItems = items.slice(0, 5);
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

  return (
    <div className="dashboard-page-container">
      <div className="breadcrumb">
        <span className="breadcrumb-current">Dashboard</span>
      </div>
      <h1 className="dashboard-page-heading">Hello, {username || "User"}</h1>
      <p className="dashboard-page-subheading">Here&apos;s what&apos;s stocked.</p>

      <div className="dashboard-grid">
        {productsLoading ? (
          <div className="dashboard-loading dashboard-grid-full" role="status">
            Loading inventory summary…
          </div>
        ) : (
          <section className="dashboard-metrics dashboard-grid-full" aria-label="Inventory metrics">
            <div className="stat-card stat-card-green">
              <div className="stat-value">{totalItems}</div>
              <div className="stat-label stat-label-green">Products tracked</div>
            </div>

            <div className="stat-card stat-card-orange">
              <div className="stat-value">{lowStockCount}</div>
              <div className="stat-label stat-label-orange">Low stock</div>
            </div>

            <div className="stat-card stat-card-yellow">
              <div className="stat-value">${totalValue.toLocaleString()}</div>
              <div className="stat-label stat-label-yellow">Total value</div>
            </div>
          </section>
        )}

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
              View all →
            </Link>
          }
          isLoading={productsLoading}
          loadingLabel="Loading recent inventory…"
          isEmpty={recentItems.length === 0}
          emptyState={<p className="dashboard-empty-state">No products have been added yet.</p>}
          className="dashboard-grid-full"
        >
          {recentItems.map((item) => (
            <div key={item._id} className="dashboard-recent-row">
              <ProductThumbnail
                images={item.images || item.catalogImages}
                photoUrl={item.photoUrl}
                name={item.name}
              />
              <span>
                <Link to={`/inventory/${item._id}`} className="item-name-link">
                  {item.name}
                </Link>
              </span>
              <span>{item.totalQuantity}</span>
              <StatusBadge
                quantity={item.totalQuantity}
                threshold={item.reorderAt != null ? item.reorderAt : null}
              />
            </div>
          ))}
        </DashboardWidget>
      </div>
    </div>
  );
}
