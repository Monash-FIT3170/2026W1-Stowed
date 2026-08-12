import { useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";
import {
  getLocationStocktakeStatus,
  getDaysUntilDue,
  getNextStocktakeDate,
  DEFAULT_STOCKTAKE_INTERVAL_DAYS,
  DUE_SOON_DAYS,
  STOCKTAKE_STATUS,
} from "/imports/api/locations/stocktake";
import { FilterChips } from "../components/FilterChips";
import "../Global.css";
import "./AlertsPage.css";

const MAX_ITEM_CHIPS = 5;

function formatDate(date) {
  if (!date) return "Never";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "12 days overdue" / "due in 3 days" — the headline on each alert.
function describeTiming(daysUntilDue) {
  if (daysUntilDue === null) return "Never counted";
  if (daysUntilDue > 0) {
    return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
  }
  const overdueBy = Math.abs(daysUntilDue);
  if (overdueBy === 0) return "Due today";
  return `${overdueBy} day${overdueBy === 1 ? "" : "s"} overdue`;
}

/**
 * Stock Alerts
 *
 * Lists every storage location whose stocktake deadline has passed (or is
 * about to), so staff know what still needs counting. Deadlines come from the
 * parent Site's `stocktakeIntervalDays` — 180 by default.
 *
 * Due dates are derived on the fly from each location's `lastStocktakeAt` and
 * its parent Site's interval, using the shared maths in
 * `/imports/api/locations/stocktake`, so the list is always current.
 */
export function AlertsPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  // Which placeholder button was pressed last, so we can explain inline that
  // it is not connected yet. Shape: { locationId, message }.
  const [placeholderNotice, setPlaceholderNotice] = useState(null);

  const { loading, storageLocations, storageUnits, floorMaps, sites, products, productRecords } =
    useTracker(() => {
      const locationsHandle = Meteor.subscribe("locations.all");
      const productsHandle = Meteor.subscribe("products");
      const recordsHandle = Meteor.subscribe("productRecords");

      return {
        loading: !locationsHandle.ready() || !productsHandle.ready() || !recordsHandle.ready(),
        storageLocations: StorageLocations.find().fetch(),
        storageUnits: StorageUnits.find().fetch(),
        floorMaps: FloorMaps.find().fetch(),
        sites: Sites.find().fetch(),
        products: Products.find().fetch(),
        productRecords: ProductRecords.find().fetch(),
      };
    }, []);

  const alerts = useMemo(() => {
    const unitsById = new Map(storageUnits.map((unit) => [unit._id, unit]));
    const floorMapsById = new Map(floorMaps.map((floorMap) => [floorMap._id, floorMap]));
    const sitesById = new Map(sites.map((site) => [site._id, site]));
    const productsById = new Map(products.map((product) => [product._id, product]));

    // locationId -> [{ name, quantity }]
    const itemsByLocationId = new Map();
    for (const record of productRecords) {
      const product = productsById.get(record.productId);
      if (!product) continue;
      const existing = itemsByLocationId.get(record.locationId) ?? [];
      existing.push({ name: product.name, quantity: record.quantity });
      itemsByLocationId.set(record.locationId, existing);
    }

    const now = new Date();

    return (
      storageLocations
        .map((location) => {
          const unit = unitsById.get(location.storageUnitId);
          const floorMap = unit ? floorMapsById.get(unit.floorMapId) : null;
          const site = floorMap ? sitesById.get(floorMap.siteId) : null;
          const intervalDays = site?.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS;

          return {
            location,
            status: getLocationStocktakeStatus(location.lastStocktakeAt, intervalDays, now),
            daysUntilDue: getDaysUntilDue(location.lastStocktakeAt, intervalDays, now),
            dueDate: getNextStocktakeDate(location.lastStocktakeAt, intervalDays),
            intervalDays,
            path: [site?.name, floorMap?.name, unit?.name].filter(Boolean).join(" › "),
            items: itemsByLocationId.get(location._id) ?? [],
          };
        })
        .filter((alert) => alert.status !== STOCKTAKE_STATUS.OK)
        // Most urgent first: the further past its deadline, the higher it sits.
        .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0))
    );
  }, [storageLocations, storageUnits, floorMaps, sites, products, productRecords]);

  const overdueCount = alerts.filter((a) => a.status === STOCKTAKE_STATUS.OVERDUE).length;
  const dueSoonCount = alerts.filter((a) => a.status === STOCKTAKE_STATUS.DUE_SOON).length;

  const visibleAlerts = useMemo(() => {
    if (activeFilter === "all") return alerts;
    return alerts.filter((alert) => alert.status === activeFilter);
  }, [alerts, activeFilter]);

  const filters = [
    { id: "all", label: "All", count: alerts.length },
    { id: STOCKTAKE_STATUS.OVERDUE, label: "⚠ Overdue", count: overdueCount },
    { id: STOCKTAKE_STATUS.DUE_SOON, label: "Due soon", count: dueSoonCount },
  ];

  // TODO(backend): call the existing `storageLocations.stocktakeComplete`
  // method with { locationId }. It already stamps lastStocktakeAt, but needs
  // permission + org checks added before being exposed.
  const handleMarkComplete = (alert) => {
    setPlaceholderNotice({
      locationId: alert.location._id,
      message: "“Mark complete” is not connected yet — this stocktake is still outstanding.",
    });
  };

  return (
    <div className="product-detail-container">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Tools</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Alerts</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">
            Stock <em>Alerts</em>
          </h1>
        </div>
      </div>

      <div style={{ padding: "0 28px 48px" }}>
        {loading ? (
          <div className="alerts-empty">Loading alerts...</div>
        ) : (
          <>
            <div className="alerts-summary">
              <span>
                <strong>{overdueCount}</strong> Overdue
              </span>
              <span>
                <strong>{dueSoonCount}</strong> Due within {DUE_SOON_DAYS} days
              </span>
              <span>
                <strong>{storageLocations.length}</strong> Storage locations tracked
              </span>
            </div>

            <FilterChips
              filters={filters}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            {visibleAlerts.length === 0 ? (
              <div className="alerts-empty">
                {alerts.length === 0
                  ? "Nothing to count. Every storage location has been stocktaken within its site's interval."
                  : "No alerts match this filter."}
              </div>
            ) : (
              <div className="alert-list">
                {visibleAlerts.map((alert) => {
                  const isOverdue = alert.status === STOCKTAKE_STATUS.OVERDUE;
                  const shownItems = alert.items.slice(0, MAX_ITEM_CHIPS);
                  const hiddenItemCount = alert.items.length - shownItems.length;
                  const showNotice = placeholderNotice?.locationId === alert.location._id;

                  return (
                    <article key={alert.location._id} className={`alert-card ${alert.status}`}>
                      <a
                        className="alert-location-link"
                        href={`/locations/${alert.location._id}`}
                        aria-label={`View details for ${alert.location.name || "unnamed location"}`}
                      >
                        <div className="alert-card-top">
                          <div>
                            <h2 className="alert-title">
                              {alert.location.name || "Unnamed location"}
                              {alert.location.code && (
                                <span className="alert-code">{alert.location.code}</span>
                              )}
                            </h2>
                            <p className="alert-path">{alert.path || "Unlinked location"}</p>
                          </div>
                          <span className={`alert-badge ${alert.status}`}>
                            {isOverdue && "⚠ "}
                            {describeTiming(alert.daysUntilDue)}
                          </span>
                        </div>

                        <dl className="alert-dates">
                          <div>
                            <dt>Last counted</dt>
                            <dd>{formatDate(alert.location.lastStocktakeAt)}</dd>
                          </div>
                          <div>
                            <dt>Due</dt>
                            <dd>{formatDate(alert.dueDate)}</dd>
                          </div>
                          <div>
                            <dt>Interval</dt>
                            <dd>{alert.intervalDays} days</dd>
                          </div>
                        </dl>

                        <div className="alert-items">
                          <div className="alert-items-title">
                            {alert.items.length === 0
                              ? "No products recorded in this location"
                              : `Items to count (${alert.items.length})`}
                          </div>
                          {shownItems.length > 0 && (
                            <div className="alert-item-chips">
                              {shownItems.map((item, index) => (
                                <span key={`${item.name}-${index}`} className="alert-item-chip">
                                  {item.name}
                                  <span>×{item.quantity}</span>
                                </span>
                              ))}
                              {hiddenItemCount > 0 && (
                                <span className="alert-item-chip">+{hiddenItemCount} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      </a>

                      <div className="alert-actions">
                        <a className="btn-secondary" href={`/stocktake/${alert.location._id}`}>
                          Update stock
                        </a>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleMarkComplete(alert)}
                        >
                          Mark complete
                        </button>
                      </div>

                      {showNotice && (
                        <p className="alert-placeholder-note" role="status" aria-live="polite">
                          {placeholderNotice.message}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
