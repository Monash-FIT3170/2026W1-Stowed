import { useParams, useNavigate, Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products, ProductRecords } from "../../api/products/collections";
import { Sites, FloorMaps, StorageUnits, StorageLocations } from "../../api/locations/collections";
import "./StocktakePage.css";
import "../Global.css";

function formatDate(date) {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Presentational half of the stocktake screen. Kept separate from the data
 * loading below so it can be rendered from tests with plain fixtures.
 *
 * Every control here is deliberately inert for now — the counting behaviour
 * lands in a follow-up.
 */
export function StocktakeView({ location, unit, floorMap, site, rows = [] }) {
  const navigate = useNavigate();

  if (!location) {
    return <p className="stocktake-message">Storage location not found.</p>;
  }

  return (
    <div className="stocktake-page">
      <header className="stocktake-header">
        <div className="stocktake-header-top">
          <div className="breadcrumb">
            <Link to="/locations" className="breadcrumb-link">
              Locations
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">
              {[site?.name, floorMap?.name, unit?.name].filter(Boolean).join(" / ") || "Stocktake"}
            </span>
          </div>
          <div className="stocktake-header-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Back
            </button>
            <button type="button" className="btn-primary">
              Save stocktake
            </button>
          </div>
        </div>

        <h1 className="stocktake-title">
          Stocktake <em>{location.name || location.code}</em>
        </h1>

        <div className="stocktake-meta">
          <span>{location.code ? `Code ${location.code}` : "No code"}</span>
          <span>
            {rows.length} product{rows.length === 1 ? "" : "s"} stored here
          </span>
          <span>Last counted {formatDate(location.lastStocktakeAt)}</span>
        </div>
      </header>

      <section className="stocktake-panel">
        <div className="stocktake-panel-title">
          <span className="stocktake-panel-badge">QT</span>
          Count the products in this location
        </div>

        {rows.length > 0 ? (
          <ul className="stocktake-rows">
            {rows.map((row) => (
              <li className="stocktake-row" key={row.recordId}>
                <div className="stocktake-row-product">
                  <span className="stocktake-row-name">{row.name}</span>
                  <small className="stocktake-row-sku">{row.sku ? row.sku : "No SKU"}</small>
                </div>

                <div className="stocktake-row-controls">
                  <button
                    type="button"
                    className="stocktake-step-btn"
                    aria-label={`Decrease quantity of ${row.name}`}
                  >
                    −
                  </button>
                  {/* Uncontrolled on purpose: the field is typeable now, but nothing
                      persists what is typed until the save behaviour is built. */}
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input stocktake-qty-input"
                    defaultValue={row.quantity}
                    aria-label={`Counted quantity of ${row.name}`}
                  />
                  <button
                    type="button"
                    className="stocktake-step-btn"
                    aria-label={`Increase quantity of ${row.name}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="btn-danger stocktake-delete-btn"
                    aria-label={`Remove ${row.name} from this location`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="stocktake-empty">No products are stored in this location yet.</div>
        )}

        <div className="stocktake-footer">
          <button type="button" className="btn-secondary stocktake-add-btn">
            + Add product
          </button>
        </div>
      </section>
    </div>
  );
}

export function StocktakePage() {
  const { locationId } = useParams();

  const { isLoading, location, unit, floorMap, site, rows } = useTracker(() => {
    const handleProducts = Meteor.subscribe("products");
    const handleRecords = Meteor.subscribe("productRecords");
    const handleLocations = Meteor.subscribe("locations.all");

    const location = StorageLocations.findOne(locationId);
    const unit = location ? StorageUnits.findOne(location.storageUnitId) : null;
    const floorMap = unit ? FloorMaps.findOne(unit.floorMapId) : null;
    const site = floorMap ? Sites.findOne(floorMap.siteId) : null;

    // ProductRecords hold the per-location quantities; Products holds the
    // name/SKU, so each row is a join of the two.
    const rows = ProductRecords.find({ locationId }, { sort: { quantity: -1 } })
      .fetch()
      .map((record) => {
        const product = Products.findOne(record.productId);
        return {
          recordId: record._id,
          productId: record.productId,
          name: product?.name || "Unknown product",
          sku: product?.sku || "",
          quantity: record.quantity,
        };
      });

    return {
      isLoading: !handleProducts.ready() || !handleRecords.ready() || !handleLocations.ready(),
      location,
      unit,
      floorMap,
      site,
      rows,
    };
  }, [locationId]);

  if (isLoading) return <p className="stocktake-message">Loading...</p>;

  return (
    <StocktakeView location={location} unit={unit} floorMap={floorMap} site={site} rows={rows} />
  );
}
