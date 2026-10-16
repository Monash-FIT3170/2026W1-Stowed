import { useEffect, useId, useMemo, useRef, useState } from "react";
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
 * Behaves as a combobox: the results close on Escape or a click elsewhere,
 * the whole row is the target, and arrow keys + Enter pick without the mouse.
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
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const idPrefix = useId();
  const listId = `${idPrefix}-results`;
  const optionId = (index) => `${idPrefix}-option-${index}`;
  const trimmed = query.trim();

  const { results, total } = useMemo(() => {
    if (!trimmed) return { results: [], total: 0 };
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

    return {
      results: rankSearchRows(rows, currentMapId, unitMaps).slice(0, MAX_RESULTS),
      total: rows.length,
    };
  }, [products, placements, currentMapId, unitMaps, trimmed]);

  const canShow = (row) => Boolean(row && unitMaps.get(row.unitId));
  const showResults = open && Boolean(trimmed);

  // Clicking anywhere outside the search closes the results; the listener is
  // only attached while they are showing.
  useEffect(() => {
    if (!showResults) return undefined;
    function onPointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showResults]);

  // Keep the keyboard-highlighted row in view inside the scrolling list.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`${idPrefix}-option-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, idPrefix]);

  /** Closing also drops the highlight, so reopening never shows a stale row. */
  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function pick(row) {
    if (!canShow(row)) return;
    onShowOnMap?.(row);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  /** Next row that can be shown, stepping by `step` (+1/-1) and wrapping. */
  function nextActionable(from, step) {
    for (let i = 1; i <= results.length; i++) {
      const index = (from + step * i + results.length * i) % results.length;
      if (canShow(results[index])) return index;
    }
    return -1;
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      // A search input clears itself on Escape by default; the first press
      // should only close the results, and a second one clears.
      event.preventDefault();
      if (showResults) close();
      else setQuery("");
      return;
    }
    if (!trimmed) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const start = activeIndex < 0 && step === 1 ? -1 : activeIndex < 0 ? 0 : activeIndex;
      setActiveIndex(nextActionable(start, step));
    } else if (event.key === "Enter" && showResults) {
      event.preventDefault();
      // Enter with nothing highlighted takes the best match.
      pick(results[activeIndex >= 0 ? activeIndex : nextActionable(-1, 1)]);
    }
  }

  return (
    <div className="cfm-search" ref={wrapperRef}>
      <label className="cfm-search-label" htmlFor="cfm-search-input">
        Find a product
      </label>
      <div className="cfm-search-row">
        <input
          id="cfm-search-input"
          className="cfm-search-input"
          type="search"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showResults && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          value={query}
          placeholder="Search products…"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        {trimmed && (
          <button
            type="button"
            className="cfm-search-clear"
            onClick={() => {
              setQuery("");
              setActiveIndex(-1);
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {showResults && (
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
            <>
              <ul className="cfm-result-list" id={listId} role="listbox">
                {results.map((row, index) => (
                  <SearchResultRow
                    key={row.key}
                    id={optionId(index)}
                    row={row}
                    map={unitMaps.get(row.unitId)}
                    currentMapId={currentMapId}
                    active={index === activeIndex}
                    onPick={() => pick(row)}
                    onHover={() => canShow(row) && setActiveIndex(index)}
                  />
                ))}
              </ul>
              {total > results.length && (
                <p className="cfm-results-more">
                  Showing {results.length} of {total} matches - refine your search to see more.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One search result. The whole row is the target when the product can be
 * shown on a public map; otherwise it is informational and disabled.
 * Exported for tests.
 */
export function SearchResultRow({ id, row, map, currentMapId, active, onPick, onHover }) {
  const onThisMap = map?.floorMapId === currentMapId;
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      aria-disabled={!map}
      className={`cfm-result${map ? " is-actionable" : ""}${active ? " is-active" : ""}`}
      // Keep focus in the input so the keyboard flow is not interrupted.
      onMouseDown={(event) => event.preventDefault()}
      onClick={map ? onPick : undefined}
      onMouseEnter={onHover}
    >
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
          <span className="cfm-show-btn" aria-hidden="true">
            {/* The path above already names the other map, so the pill stays short. */}
            {onThisMap ? "Show on map" : "Go to map"}
          </span>
        )}
      </div>
    </li>
  );
}
