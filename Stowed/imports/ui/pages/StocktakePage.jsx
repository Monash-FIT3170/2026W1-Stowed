import { useEffect, useState } from "react";
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

/** Quantities are held as strings so the field can be empty mid-typing. */
function toCount(quantity) {
  const parsed = parseInt(quantity, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toDraft(rows) {
  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    sku: row.sku,
    quantity: String(row.quantity),
  }));
}

/**
 * True once the draft differs from what is stored, which is what enables Save.
 * Added and removed lines both change the length; edits are compared per product.
 */
function hasChanges(draft, rows) {
  if (draft.length !== rows.length) return true;

  const stored = new Map(rows.map((row) => [row.productId, row.quantity]));
  return draft.some(
    (line) => !stored.has(line.productId) || toCount(line.quantity) !== stored.get(line.productId),
  );
}

/**
 * Presentational half of the stocktake screen. Kept separate from the data
 * loading below so it can be rendered from tests with plain fixtures.
 *
 * All editing happens on a local draft — nothing is written to the database
 * until Save reconciles the ProductRecords, which is not built yet.
 */
export function StocktakeView({ location, unit, floorMap, site, rows = [], products = [] }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => toDraft(rows));
  const [addingProductId, setAddingProductId] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Reseed when the page moves to a different location. Deliberately not keyed
  // on `rows` itself: that identity changes on every reactive re-run, which
  // would wipe the user's in-progress count.
  const locationId = location?._id;
  useEffect(() => {
    setDraft(toDraft(rows));
    setAddingProductId("");
    setIsAdding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!location) {
    return <p className="stocktake-message">Storage location not found.</p>;
  }

  function setQuantity(productId, value) {
    // Digits only, so the field can never hold a negative or fractional count.
    const digits = value.replace(/[^0-9]/g, "");
    setDraft((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, quantity: digits } : line)),
    );
  }

  function stepQuantity(productId, delta) {
    setDraft((prev) =>
      prev.map((line) =>
        line.productId === productId
          ? { ...line, quantity: String(Math.max(0, toCount(line.quantity) + delta)) }
          : line,
      ),
    );
  }

  function removeLine(productId) {
    setDraft((prev) => prev.filter((line) => line.productId !== productId));
  }

  function addLine() {
    const product = products.find((candidate) => candidate._id === addingProductId);
    if (!product) return;

    setDraft((prev) => [
      ...prev,
      {
        productId: product._id,
        name: product.name,
        sku: product.sku || "",
        quantity: "0",
      },
    ]);
    setAddingProductId("");
    setIsAdding(false);
  }

  function discardChanges() {
    setDraft(toDraft(rows));
    setAddingProductId("");
    setIsAdding(false);
  }

  const isDirty = hasChanges(draft, rows);
  const countedTotal = draft.reduce((total, line) => total + toCount(line.quantity), 0);
  // A product can only be counted once per location, so hide the ones already listed.
  const availableProducts = products
    .filter((product) => !draft.some((line) => line.productId === product._id))
    .sort((a, b) => a.name.localeCompare(b.name));

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
            {isDirty && (
              <button type="button" className="btn-secondary" onClick={discardChanges}>
                Discard
              </button>
            )}
            {/* Reconciling the ProductRecords is the next piece of work. */}
            <button type="button" className="btn-primary" disabled={!isDirty}>
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
            {draft.length} product{draft.length === 1 ? "" : "s"} · {countedTotal} units counted
          </span>
          <span>Last counted {formatDate(location.lastStocktakeAt)}</span>
          {isDirty && <span className="stocktake-dirty">Unsaved changes</span>}
        </div>
      </header>

      <section className="stocktake-panel">
        <div className="stocktake-panel-title">
          <span className="stocktake-panel-badge">QT</span>
          Count the products in this location
        </div>

        {draft.length > 0 ? (
          <ul className="stocktake-rows">
            {draft.map((line) => (
              <li className="stocktake-row" key={line.productId}>
                <div className="stocktake-row-product">
                  <span className="stocktake-row-name">{line.name}</span>
                  <small className="stocktake-row-sku">{line.sku ? line.sku : "No SKU"}</small>
                </div>

                <div className="stocktake-row-controls">
                  <button
                    type="button"
                    className="stocktake-step-btn"
                    onClick={() => stepQuantity(line.productId, -1)}
                    disabled={toCount(line.quantity) === 0}
                    aria-label={`Decrease quantity of ${line.name}`}
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input stocktake-qty-input"
                    value={line.quantity}
                    onChange={(event) => setQuantity(line.productId, event.target.value)}
                    aria-label={`Counted quantity of ${line.name}`}
                  />
                  <button
                    type="button"
                    className="stocktake-step-btn"
                    onClick={() => stepQuantity(line.productId, 1)}
                    aria-label={`Increase quantity of ${line.name}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="btn-danger stocktake-delete-btn"
                    onClick={() => removeLine(line.productId)}
                    aria-label={`Remove ${line.name} from this location`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="stocktake-empty">No products counted in this location.</div>
        )}

        <div className="stocktake-footer">
          {isAdding ? (
            <div className="stocktake-add-row">
              <select
                className="form-input stocktake-add-select"
                value={addingProductId}
                onChange={(event) => setAddingProductId(event.target.value)}
                aria-label="Product to add"
              >
                <option value="">Select a product...</option>
                {availableProducts.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name}
                    {product.sku ? ` (${product.sku})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={addLine}
                disabled={!addingProductId}
              >
                Add
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsAdding(false);
                  setAddingProductId("");
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary stocktake-add-btn"
              onClick={() => setIsAdding(true)}
              disabled={availableProducts.length === 0}
            >
              + Add product
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export function StocktakePage() {
  const { locationId } = useParams();

  const { isLoading, location, unit, floorMap, site, rows, products } = useTracker(() => {
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
      products: Products.find({}, { sort: { name: 1 } }).fetch(),
    };
  }, [locationId]);

  if (isLoading) return <p className="stocktake-message">Loading...</p>;

  return (
    <StocktakeView
      location={location}
      unit={unit}
      floorMap={floorMap}
      site={site}
      rows={rows}
      products={products}
    />
  );
}
