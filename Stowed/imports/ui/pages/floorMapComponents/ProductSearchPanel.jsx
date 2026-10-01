import { useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { StorageLocations, StorageUnits } from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";
import { searchProducts } from "/imports/api/products/filters";

/**
 * Every product stocked on this floor map, one row per location it sits in -
 * a product split across two shelves is two rows, since the point of the
 * search is answering "where is it", not "how many are there in total".
 *
 * @param {string|undefined} floorMapId
 */
function useStockedProducts(floorMapId) {
  return useTracker(() => {
    const locationsHandle = Meteor.subscribe("locations.all");
    const productsHandle = Meteor.subscribe("products");
    const recordsHandle = Meteor.subscribe("productRecords");

    const loading =
      !locationsHandle.ready() || !productsHandle.ready() || !recordsHandle.ready();

    if (!floorMapId) return { entries: [], loading };

    const units = StorageUnits.find({ floorMapId }).fetch();
    const unitsById = new Map(units.map((unit) => [unit._id, unit]));

    const locations = StorageLocations.find({
      storageUnitId: { $in: units.map((unit) => unit._id) },
    }).fetch();

    const entries = [];
    for (const location of locations) {
      const unit = unitsById.get(location.storageUnitId);
      if (!unit) continue;

      for (const record of ProductRecords.find({ locationId: location._id }).fetch()) {
        const product = Products.findOne(record.productId);
        if (!product) continue;

        entries.push({
          key: `${record._id}`,
          product,
          quantity: record.quantity,
          location,
          unit,
        });
      }
    }

    return { entries, loading };
  }, [floorMapId]);
}

/**
 * Search box over the products stocked on the current floor map. Selecting a
 * result asks the page to pan the canvas to the owning unit and open it.
 *
 * @param {string|undefined} floorMapId
 * @param {(entry: { unit: object, location: object }) => void} onShowOnMap
 */
export function ProductSearchPanel({ floorMapId, onShowOnMap }) {
  const [query, setQuery] = useState("");
  const { entries, loading } = useStockedProducts(floorMapId);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // searchProducts works on products, so match on those then keep every
    // placement of the ones that matched.
    const matchedIds = new Set(
      searchProducts(
        entries.map((entry) => entry.product),
        trimmed,
      ).map((product) => product._id),
    );

    return entries
      .filter((entry) => matchedIds.has(entry.product._id))
      .sort(
        (a, b) =>
          a.product.name.localeCompare(b.product.name) ||
          (a.unit.name || "").localeCompare(b.unit.name || ""),
      );
  }, [entries, query]);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="fmd-search">
      <label className="fmd-search-label" htmlFor="fmd-search-input">
        Find a product
      </label>
      <div className="fmd-search-row">
        <input
          id="fmd-search-input"
          className="fmd-search-input"
          type="search"
          value={query}
          placeholder="Search by name or SKU…"
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        {hasQuery && (
          <button
            type="button"
            className="fmd-search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {hasQuery && (
        <div className="fmd-results">
          {loading ? (
            <p className="fmd-empty small">Loading…</p>
          ) : results.length === 0 ? (
            <p className="fmd-empty small">No products on this floor map match “{query.trim()}”.</p>
          ) : (
            <ul className="fmd-result-list">
              {results.map((entry) => (
                <li key={entry.key} className="fmd-result">
                  <div className="fmd-result-text">
                    <span className="fmd-result-name">{entry.product.name}</span>
                    <span className="fmd-result-path">
                      {entry.unit.name} › {entry.location.name}
                      {entry.location.code ? ` (${entry.location.code})` : ""}
                    </span>
                  </div>
                  <div className="fmd-result-side">
                    <span className="fmd-result-qty">{entry.quantity}</span>
                    <button
                      type="button"
                      className="fmd-show-btn"
                      onClick={() => onShowOnMap?.(entry)}
                    >
                      Show on map
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
