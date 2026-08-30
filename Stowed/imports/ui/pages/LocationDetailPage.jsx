import { Link, useNavigate, useParams } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { ProductRecords, Products } from "../../api/products/collections";
import { FloorMaps, Sites, StorageLocations, StorageUnits } from "../../api/locations/collections";
import {
  DEFAULT_STOCKTAKE_INTERVAL_DAYS,
  getLocationStocktakeStatus,
  getNextStocktakeDate,
  STOCKTAKE_STATUS,
} from "../../api/locations/stocktake";
import { ProductThumbnail } from "../components/ProductThumbnail";
import "../Global.css";
import "./ProductDetailPage.css";
import "./LocationDetailPage.css";

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(status) {
  if (status === STOCKTAKE_STATUS.OVERDUE) return "Stocktake overdue";
  if (status === STOCKTAKE_STATUS.DUE_SOON) return "Stocktake due soon";
  return "Stocktake current";
}

export function LocationDetailView({ location, unit, floorMap, site, rows = [] }) {
  const navigate = useNavigate();

  if (!location) {
    return (
      <div className="product-detail-container">
        <div className="location-detail-message">Storage location not found.</div>
      </div>
    );
  }

  const intervalDays = site?.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS;
  const stocktakeStatus = getLocationStocktakeStatus(location.lastStocktakeAt, intervalDays);
  const dueDate = getNextStocktakeDate(location.lastStocktakeAt, intervalDays);
  const totalQuantity = rows.reduce((total, row) => total + row.record.quantity, 0);
  const physicalPath = [site?.name, floorMap?.name, unit?.name].filter(Boolean).join(" › ");

  return (
    <div className="product-detail-container location-detail-page">
      <div className="product-detail-header">
        <div className="header-top">
          <div className="breadcrumb">
            <Link to="/locations" className="breadcrumb-link">
              Locations
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Location</span>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Back
            </button>
            {floorMap && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(`/floor-map/${floorMap._id}`)}
              >
                Open map
              </button>
            )}
            <button
              type="button"
              className="btn-primary location-detail-desktop-cta"
              onClick={() => navigate(`/stocktake/${location._id}`)}
            >
              Start stocktake
            </button>
          </div>
        </div>

        <div className="header-content location-detail-hero">
          <div className="header-icon-section">
            {location.imageUrl ? (
              <img
                className="header-icon"
                src={location.imageUrl}
                alt={location.name || "Location"}
              />
            ) : (
              <div
                className="header-icon header-icon-placeholder location-detail-icon"
                aria-hidden="true"
              >
                ◫
              </div>
            )}
          </div>
          <div className="header-info">
            <span className={`location-detail-status ${stocktakeStatus}`}>
              {statusLabel(stocktakeStatus)}
            </span>
            <h1 className="header-title">{location.name || "Unnamed location"}</h1>
            <div className="header-meta">
              <span className="sku">{location.code || "No code"}</span>
              <span />
              <span>{physicalPath || "Unlinked location"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="product-detail-grid location-detail-grid">
        <div className="left-column">
          <section className="detail-section">
            <div className="section-title">
              <span className="section-badge im">IN</span>
              Inventory stored here
              <span className="location-detail-section-count">
                {rows.length} product{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            {rows.length === 0 ? (
              <div className="location-detail-empty">
                No products are currently assigned to this storage location.
              </div>
            ) : (
              <div className="location-product-table">
                <div className="location-product-header">
                  <span>Product</span>
                  <span>SKU</span>
                  <span>Quantity here</span>
                  <span>Total stock</span>
                  <span />
                </div>
                {rows.map((row) => (
                  <div className="location-product-row" key={row.record._id}>
                    <div className="location-product-identity">
                      <ProductThumbnail
                        name={row.product?.name}
                        images={row.product?.images}
                        photoUrl={row.product?.photoUrl}
                      />
                      <Link to={`/inventory/${row.record.productId}`}>
                        {row.product?.name || "Unknown product"}
                      </Link>
                    </div>
                    <span className="location-product-sku">{row.product?.sku || "—"}</span>
                    <strong>{row.record.quantity}</strong>
                    <span>{row.product?.totalQuantity ?? "—"}</span>
                    <Link
                      className="location-product-view"
                      to={`/inventory/${row.record.productId}`}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="right-column">
          <section className="detail-section">
            <div className="section-title">
              <span className="section-badge id">ID</span>
              Location details
            </div>
            <dl className="location-detail-list section-content">
              <div>
                <dt>Site</dt>
                <dd>{site?.name || "—"}</dd>
              </div>
              <div>
                <dt>Floor map</dt>
                <dd>{floorMap?.name || "—"}</dd>
              </div>
              <div>
                <dt>Storage unit</dt>
                <dd>{unit?.name || "—"}</dd>
              </div>
              <div>
                <dt>Unit type</dt>
                <dd>{unit?.type || "—"}</dd>
              </div>
              <div>
                <dt>Location code</dt>
                <dd>{location.code || "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-section">
            <div className="section-title">
              <span className="section-badge op">ST</span>
              Stocktake schedule
            </div>
            <dl className="location-detail-list section-content">
              <div>
                <dt>Last counted</dt>
                <dd>{formatDate(location.lastStocktakeAt)}</dd>
              </div>
              <div>
                <dt>Next due</dt>
                <dd>{formatDate(dueDate)}</dd>
              </div>
              <div>
                <dt>Site interval</dt>
                <dd>{intervalDays} days</dd>
              </div>
            </dl>
          </section>

          <section className="detail-section">
            <div className="section-title">
              <span className="section-badge lc">QT</span>
              Stock summary
            </div>
            <div className="location-detail-summary section-content">
              <div>
                <strong>{rows.length}</strong>
                <span>Product types</span>
              </div>
              <div>
                <strong>{totalQuantity}</strong>
                <span>Total units</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Tablet/phone only — the primary action moved down here so it's
          reachable at the bottom of the page instead of only up in the
          header. Desktop keeps the header button and never sees this. */}
      <div className="location-detail-mobile-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/stocktake/${location._id}`)}
        >
          Start stocktake
        </button>
      </div>
    </div>
  );
}

export function LocationDetailPage() {
  const { locationId } = useParams();
  const { loading, location, unit, floorMap, site, rows } = useTracker(() => {
    const locationsHandle = Meteor.subscribe("locations.all");
    const productsHandle = Meteor.subscribe("products");
    const recordsHandle = Meteor.subscribe("productRecords");
    const location = StorageLocations.findOne(locationId);
    const unit = location ? StorageUnits.findOne(location.storageUnitId) : null;
    const floorMap = unit ? FloorMaps.findOne(unit.floorMapId) : null;
    const site = floorMap ? Sites.findOne(floorMap.siteId) : null;
    const rows = ProductRecords.find({ locationId }, { sort: { quantity: -1 } })
      .fetch()
      .map((record) => ({ record, product: Products.findOne(record.productId) }));

    return {
      loading: !locationsHandle.ready() || !productsHandle.ready() || !recordsHandle.ready(),
      location,
      unit,
      floorMap,
      site,
      rows,
    };
  }, [locationId]);

  if (loading) {
    return (
      <div className="product-detail-container location-detail-message">Loading location…</div>
    );
  }

  return (
    <LocationDetailView
      location={location}
      unit={unit}
      floorMap={floorMap}
      site={site}
      rows={rows}
    />
  );
}
