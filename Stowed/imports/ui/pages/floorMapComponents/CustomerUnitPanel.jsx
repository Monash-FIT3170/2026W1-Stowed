import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { ShoppingListControl } from "../../components/ShoppingListControl";
import { groupUnitByShelf } from "./customerMapData";

/**
 * Shopper-facing version of the staff LocationProductsPanel: the shelves in a
 * storage unit and what is on each. Shows stock status rather than counts, and
 * links products to the customer product page instead of staff pages.
 *
 * Only shelves holding stock appear - the catalogue lists where a product is,
 * so an empty shelf has nothing to report. Every shelf starts open, so tapping
 * a unit shows everything in it at once; shoppers can still fold shelves away.
 *
 * @param {string} unitId
 * @param {string} unitName
 * @param {Array} placements - From buildPlacements.
 * @param {boolean} loading
 * @param {boolean} loadFailed - The catalogue request errored.
 * @param {string|null} focusShelfName - Scrolled to and highlighted, used by search.
 * @param {number} focusNonce - Bumped per search hit so re-picking a result refocuses it.
 * @param {() => void} onClose
 */
export function CustomerUnitPanel({
  unitId,
  unitName,
  placements,
  loading,
  loadFailed = false,
  focusShelfName,
  focusNonce = 0,
  onClose,
}) {
  const shelves = groupUnitByShelf(placements, unitId);
  // Shelves the shopper has folded away; empty means everything is open.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const shelfRefs = useRef(new Map());

  // Re-seed during render, not in an effect: a new unit or a new search hit
  // opens every shelf again.
  const focusKey = `${unitId}|${focusShelfName ?? ""}|${focusNonce}`;
  const [lastFocusKey, setLastFocusKey] = useState(focusKey);
  if (focusKey !== lastFocusKey) {
    setLastFocusKey(focusKey);
    setCollapsed(new Set());
  }

  // With every shelf open the searched one can be far down the list, so bring
  // it into view rather than leave the shopper hunting for it.
  useEffect(() => {
    if (focusShelfName == null) return;
    shelfRefs.current.get(focusShelfName)?.scrollIntoView?.({ block: "nearest" });
  }, [focusKey, focusShelfName]);

  const toggleShelf = (shelfName) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(shelfName)) next.delete(shelfName);
      else next.add(shelfName);
      return next;
    });

  const productCount = shelves.reduce((sum, shelf) => sum + shelf.products.length, 0);

  return (
    <aside className="cfm-panel" aria-label={`Products in ${unitName || "this unit"}`}>
      <div className="cfm-panel-header">
        <div>
          <span className="cfm-panel-label">Storage unit</span>
          <h2 className="cfm-panel-title">{unitName || "Unnamed unit"}</h2>
          {!loading && !loadFailed && (
            <span className="cfm-panel-meta">
              {productCount} product{productCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <button type="button" className="cfm-close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className="cfm-panel-body">
        {loading ? (
          <p className="cfm-empty">Loading…</p>
        ) : loadFailed ? (
          <p className="cfm-empty">Products couldn&apos;t be loaded. Refresh to try again.</p>
        ) : shelves.length === 0 ? (
          <p className="cfm-empty">No products are listed in this unit.</p>
        ) : (
          <ul className="cfm-shelf-list">
            {shelves.map(({ shelfName, products }) => {
              const isOpen = !collapsed.has(shelfName);
              const isFocus = focusShelfName != null && focusShelfName === shelfName;
              return (
                <li
                  key={shelfName || "_unit"}
                  ref={(node) => {
                    if (node) shelfRefs.current.set(shelfName, node);
                    else shelfRefs.current.delete(shelfName);
                  }}
                  className={`cfm-shelf${isOpen ? " open" : ""}${isFocus ? " cfm-shelf--focus" : ""}`}
                >
                  <button
                    type="button"
                    className="cfm-shelf-toggle"
                    aria-expanded={isOpen}
                    onClick={() => toggleShelf(shelfName)}
                  >
                    <span className="cfm-caret" aria-hidden="true">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <span className="cfm-shelf-name">{shelfName || "General"}</span>
                    <span className="cfm-shelf-count">{products.length}</span>
                  </button>

                  {isOpen && (
                    <ul className="cfm-product-list">
                      {products.map((product) => (
                        <li key={product._id} className="cfm-product-row">
                          <Link className="cfm-product" to={`/customer/search/${product._id}`}>
                            <span className="cfm-product-name">{product.name}</span>
                            <StatusBadge status={product.stockStatus} />
                          </Link>
                          {/* A sibling of the link, not inside it: a button
                              within a link would navigate on every press. */}
                          <ShoppingListControl
                            productId={product._id}
                            productName={product.name}
                            variant="compact"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
