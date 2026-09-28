import { useState } from "react";
import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { StorageLocations } from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";

/**
 * Builds the location -> products tree for one storage unit.
 *
 * Storage locations carry no geometry of their own, so the map can only draw
 * units; this panel is where a unit is opened up to reveal the locations
 * inside it and the stock sitting in each.
 *
 * @param {string|null} unitId
 * @returns {{ rows: Array, loading: boolean }}
 */
function useUnitContents(unitId) {
  return useTracker(() => {
    const locationsHandle = Meteor.subscribe("locations.all");
    const productsHandle = Meteor.subscribe("products");
    const recordsHandle = Meteor.subscribe("productRecords");

    const loading =
      !locationsHandle.ready() || !productsHandle.ready() || !recordsHandle.ready();

    if (!unitId) return { rows: [], loading };

    const locations = StorageLocations.find(
      { storageUnitId: unitId },
      { sort: { name: 1 } },
    ).fetch();

    const rows = locations.map((location) => {
      const products = ProductRecords.find({ locationId: location._id })
        .fetch()
        .map((record) => {
          const product = Products.findOne(record.productId);
          return product
            ? { productId: product._id, name: product.name, quantity: record.quantity }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      return { location, products };
    });

    return { rows, loading };
  }, [unitId]);
}

/**
 * Right-hand panel of the floor map detail page.
 *
 * @param {{ _id?: string, id?: string, name: string }} unit
 * @param {string|null} focusLocationId - Expanded automatically, used by search.
 * @param {number} focusNonce - Bumped per search hit so re-picking the same
 *   result re-expands it even when the location id has not changed.
 * @param {() => void} onClose
 */
export function LocationProductsPanel({ unit, focusLocationId, focusNonce = 0, onClose }) {
  const unitId = unit?._id ?? unit?.id ?? null;
  const { rows, loading } = useUnitContents(unitId);
  const [expandedId, setExpandedId] = useState(focusLocationId ?? null);

  // Re-seed the expansion during render rather than in an effect: a new unit
  // makes the old expansion meaningless, and a search hit picks one for the
  // user. See https://react.dev/learn/you-might-not-need-an-effect
  const focusKey = `${unitId}|${focusLocationId ?? ""}|${focusNonce}`;
  const [lastFocusKey, setLastFocusKey] = useState(focusKey);
  if (focusKey !== lastFocusKey) {
    setLastFocusKey(focusKey);
    setExpandedId(focusLocationId ?? null);
  }

  const totalProducts = rows.reduce((sum, row) => sum + row.products.length, 0);

  return (
    <aside className="fmd-panel">
      <div className="fmd-panel-header">
        <div className="fmd-panel-heading">
          <span className="fmd-panel-label">Storage unit</span>
          <h2 className="fmd-panel-title">{unit?.name || "Unnamed unit"}</h2>
          <span className="fmd-panel-meta">
            {rows.length} location{rows.length === 1 ? "" : "s"} · {totalProducts} product
            {totalProducts === 1 ? "" : "s"}
          </span>
        </div>
        <button type="button" className="fmd-close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className="fmd-panel-body">
        {loading ? (
          <p className="fmd-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="fmd-empty">No storage locations in this unit.</p>
        ) : (
          <ul className="fmd-location-list">
            {rows.map(({ location, products }) => {
              const isOpen = expandedId === location._id;
              return (
                <li key={location._id} className={`fmd-location${isOpen ? " open" : ""}`}>
                  <button
                    type="button"
                    className="fmd-location-toggle"
                    aria-expanded={isOpen}
                    onClick={() => setExpandedId(isOpen ? null : location._id)}
                  >
                    <span className="fmd-caret" aria-hidden="true">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <span className="fmd-location-text">
                      <span className="fmd-location-name">{location.name || "Unnamed"}</span>
                      {location.code && <span className="fmd-location-code">{location.code}</span>}
                    </span>
                    <span className="fmd-location-count">{products.length}</span>
                  </button>

                  {isOpen && (
                    <div className="fmd-products">
                      {products.length === 0 ? (
                        <p className="fmd-empty small">No products in this location.</p>
                      ) : (
                        <ul className="fmd-product-list">
                          {products.map((product) => (
                            <li key={product.productId} className="fmd-product">
                              <span className="fmd-product-name">{product.name}</span>
                              <span className="fmd-product-qty">{product.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link className="fmd-location-link" to={`/locations/${location._id}`}>
                        Open location →
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {unitId && (
        <div className="fmd-panel-footer">
          <Link className="fmd-detail-link" to={`/locations/unit/${unitId}`}>
            Open full unit detail
          </Link>
        </div>
      )}
    </aside>
  );
}
