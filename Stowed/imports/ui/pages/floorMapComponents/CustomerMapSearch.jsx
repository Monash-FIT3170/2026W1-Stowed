import { useMemo, useState } from "react";
import { searchProducts } from "/imports/api/products/filters";
import { CUSTOMER_SEARCH_FIELDS } from "/imports/api/customer/catalogue";
import { StatusBadge } from "../../components/StatusBadge";
import { rankSearchRows } from "./customerMapData";

const MAX_RESULTS = 30;

/**
 * Product search for the customer floor map, over the same fields as the
 * customer search page (name, brand, description, category).
 *
 * Results are one row per shelf a product sits on. Any shelf on a public map
 * can be shown: on this map it pans there, on another it switches maps first.
 * A unit on a private map still shows its label, so a shopper learns where it
 * is without that map being exposed.
 *
 * @param {Array} products - Customer products from customer.products.list.
 * @param {Array} placements - From buildPlacements(products).
 * @param {string} currentMapId - The map being viewed.
 * @param {Map<string, { floorMapId: string, mapLabel: string }>} unitMaps - From buildUnitMaps.
 * @param {boolean} loading
 * @param {(placement: object) => void} onShowOnMap
 */
export function CustomerMapSearch({
  products,
  placements,
  currentMapId,
  unitMaps,
  loading,
  loadFailed = false,
  onShowOnMap,
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const results = useMemo(() => {
    if (!trimmed) return [];
    const matchedIds = new Set(
      searchProducts(products, trimmed, CUSTOMER_SEARCH_FIELDS).map((product) => product._id),
    );

    const rows = placements.filter((placement) => matchedIds.has(placement.product._id));

    // A matched product with nowhere listed still deserves a row, so the
    // shopper isn't told it doesn't exist.
    const placedIds = new Set(rows.map((row) => row.product._id));
    for (const product of products) {
      if (matchedIds.has(product._id) && !placedIds.has(product._id)) {
        rows.push({ key: `${product._id}|none`, product, unitId: null, label: "" });
      }
    }

    return rankSearchRows(rows, currentMapId, unitMaps).slice(0, MAX_RESULTS);
  }, [products, placements, currentMapId, unitMaps, trimmed]);

  return (
    <div className="cfm-search">
      <label className="cfm-search-label" htmlFor="cfm-search-input">
        Find a product
      </label>
      <div className="cfm-search-row">
        <input
          id="cfm-search-input"
          className="cfm-search-input"
          type="search"
          value={query}
          placeholder="Search products…"
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        {trimmed && (
          <button
            type="button"
            className="cfm-search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {trimmed && (
        <div className="cfm-results" role="region" aria-label="Search results">
          {loading ? (
            <p className="cfm-empty small">Loading…</p>
          ) : loadFailed ? (
            <p className="cfm-empty small">
              Products couldn&apos;t be loaded. Refresh to try again.
            </p>
          ) : results.length === 0 ? (
            <p className="cfm-empty small">No products match “{trimmed}”.</p>
          ) : (
            <ul className="cfm-result-list">
              {results.map((row) => {
                const map = unitMaps.get(row.unitId);
                const onThisMap = map?.floorMapId === currentMapId;
                return (
                  <li key={row.key} className="cfm-result">
                    <div className="cfm-result-text">
                      <span className="cfm-result-name">{row.product.name}</span>
                      <span className="cfm-result-path">
                        {row.label || "Location not listed"}
                        {row.label && map && !onThisMap ? ` · ${map.mapLabel}` : ""}
                        {row.label && !map ? " · ask staff for directions" : ""}
                      </span>
                    </div>
                    <div className="cfm-result-side">
                      <StatusBadge status={row.product.stockStatus} />
                      {map && (
                        <button
                          type="button"
                          className="cfm-show-btn"
                          onClick={() => {
                            onShowOnMap?.(row);
                            setQuery("");
                          }}
                        >
                          {onThisMap ? "Show on map" : `Go to ${map.mapLabel}`}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
