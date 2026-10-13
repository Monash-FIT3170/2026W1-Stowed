import { useEffect, useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Link, useSearchParams } from "react-router-dom";
import { getCustomerOrgCode } from "../customerSession";
import { ShoppingListControl } from "../components/ShoppingListControl";
import { FilterChips } from "../components/FilterChips";
import { StatusBadge } from "../components/StatusBadge";
import { Pagination } from "../components/Pagination";
import { ProductThumbnail } from "./InventoryListPage";
import { currency } from "./shoppingListHelpers";
import { searchProducts, STOCK_STATUS } from "/imports/api/products/filters";
import {
  CUSTOMER_SEARCH_FIELDS,
  CUSTOMER_SORTS,
  DEFAULT_CUSTOMER_SORT,
  filterCustomerProducts,
  isCustomerSort,
  sortCustomerProducts,
} from "/imports/api/customer/catalogue";
import "../Global.css";
import "./CustomerProductSearchPage.css";

/**
 * PRODUCT SEARCH
 * The organisation's catalogue as a shopper sees it: read-only, with only what
 * helps them buy and find an item - price, stock status and where it sits in
 * the store. The server hands over that whitelisted shape (see
 * imports/api/customer), so nothing staff-only ever reaches this page.
 *
 * Search, filters, sort and page live in the URL, like the inventory list's
 * ?filter=, so going back from a product keeps the shopper's place.
 */

const PAGE_SIZE = 24;

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: STOCK_STATUS.IN, label: "In stock" },
  { id: STOCK_STATUS.LOW, label: "Low stock" },
  { id: STOCK_STATUS.OUT, label: "Out of stock" },
];

const STATUS_FILTER_IDS = new Set(STATUS_FILTERS.map((filter) => filter.id));

// Distinct { id, name } options from the products themselves, so a shopper is
// only offered categories and aisles that actually have something in them.
function uniqueOptions(pairs) {
  const byId = new Map();
  for (const [id, name] of pairs) {
    if (id && name && !byId.has(id)) byId.set(id, name);
  }
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function CustomerProductSearchPage() {
  const orgCode = getCustomerOrgCode();
  const [products, setProducts] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const requestedStatus = searchParams.get("status");
  const status = STATUS_FILTER_IDS.has(requestedStatus) ? requestedStatus : "all";
  const categoryId = searchParams.get("category") ?? "";
  const unitId = searchParams.get("unit") ?? "";
  const requestedSort = searchParams.get("sort");
  const sort = isCustomerSort(requestedSort) ? requestedSort : DEFAULT_CUSTOMER_SORT;
  const requestedPage = Number.parseInt(searchParams.get("page"), 10);

  // Bumped by the Refresh and Try again buttons to fetch the catalogue again.
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let current = true;
    Meteor.callAsync("customer.products.list", { orgCode })
      .then((result) => {
        if (!current) return;
        setProducts(result);
        setLoadState("ready");
      })
      .catch((err) => {
        console.error("Failed to load the catalogue:", err);
        if (current) setLoadState("error");
      });
    // A response that lands after the page has moved on is dropped.
    return () => {
      current = false;
    };
  }, [orgCode, reloadCount]);

  const reloadProducts = () => {
    setLoadState("loading");
    setReloadCount((count) => count + 1);
  };

  // Any change but a page turn starts the results over at page 1. Replacing
  // rather than pushing keeps each keystroke in the search box out of history.
  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const categories = useMemo(
    () => uniqueOptions(products.map((p) => [p.categoryId, p.categoryName])),
    [products],
  );
  const units = useMemo(
    () => uniqueOptions(products.flatMap((p) => p.locations.map((l) => [l.unitId, l.unitName]))),
    [products],
  );

  // Status counts follow the search and dropdowns but not the status chip
  // itself, so each chip says how many results choosing it would give.
  const matching = useMemo(
    () =>
      filterCustomerProducts(searchProducts(products, query, CUSTOMER_SEARCH_FIELDS), {
        categoryId,
        unitId,
      }),
    [products, query, categoryId, unitId],
  );

  const results = useMemo(
    () =>
      sortCustomerProducts(
        status === "all" ? matching : filterCustomerProducts(matching, { status }),
        sort,
      ),
    [matching, status, sort],
  );

  const statusFilters = STATUS_FILTERS.map((filter) => ({
    ...filter,
    count:
      filter.id === "all"
        ? matching.length
        : matching.filter((item) => item.stockStatus === filter.id).length,
  }));

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const currentPage = Math.min(Math.max(requestedPage || 1, 1), Math.max(totalPages, 1));
  const pagedResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasRefinements = Boolean(query || status !== "all" || categoryId || unitId);

  return (
    <div className="customer-page customer-search">
      <div className="customer-search-header">
        <h1 className="customer-page-title">Product Search</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={reloadProducts}
          disabled={loadState === "loading"}
        >
          Refresh
        </button>
      </div>

      <div className="customer-search-controls">
        <input
          type="search"
          value={query}
          onChange={(e) => updateParams({ q: e.target.value })}
          placeholder="Search by name, brand or category"
          aria-label="Search products"
          className="search-input customer-search-input"
        />

        <FilterChips
          filters={statusFilters}
          activeFilter={status}
          onFilterChange={(id) => updateParams({ status: id === "all" ? "" : id })}
        />

        <div className="customer-search-selects">
          <label className="customer-search-select">
            <span>Category</span>
            <select
              value={categoryId}
              onChange={(e) => updateParams({ category: e.target.value })}
              className="form-input"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>

          <label className="customer-search-select">
            <span>Location</span>
            <select
              value={unitId}
              onChange={(e) => updateParams({ unit: e.target.value })}
              className="form-input"
            >
              <option value="">Anywhere in store</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>

          <label className="customer-search-select">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(e) =>
                updateParams({
                  sort: e.target.value === DEFAULT_CUSTOMER_SORT ? "" : e.target.value,
                })
              }
              className="form-input"
            >
              {CUSTOMER_SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loadState === "loading" && <div className="empty-state">Loading products...</div>}

      {loadState === "error" && (
        <div className="empty-state">
          <p>{"We couldn't load this store's products."}</p>
          <button type="button" className="btn-secondary" onClick={reloadProducts}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && results.length === 0 && (
        <div className="empty-state">
          {products.length === 0 ? (
            "This store hasn't listed any products yet."
          ) : (
            <>
              <p>No products match your search.</p>
              {hasRefinements && (
                <button type="button" className="btn-secondary" onClick={() => setSearchParams({})}>
                  Clear search and filters
                </button>
              )}
            </>
          )}
        </div>
      )}

      {loadState === "ready" && results.length > 0 && (
        <>
          <p className="customer-search-count">
            {results.length} of {products.length} products
          </p>

          <ul className="customer-product-grid">
            {pagedResults.map((product) => (
              <li key={product._id}>
                {/* The control is a sibling of the card, not a child: the card
                    is a Link, and buttons inside a link are neither valid nor
                    clickable without navigating. The li carries the card shell
                    so the two still read as one. */}
                <Link to={`/customer/search/${product._id}`} className="customer-product-card">
                  <div className="customer-product-image">
                    <ProductThumbnail images={product.images} name={product.name} />
                  </div>
                  <div className="customer-product-body">
                    <StatusBadge status={product.stockStatus} />
                    <h2 className="customer-product-name">{product.name}</h2>
                    {(product.brand || product.categoryName) && (
                      <p className="customer-product-meta">
                        {[product.brand, product.categoryName].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="customer-product-price">
                      {product.price != null ? currency(product.price) : "Price on request"}
                    </p>
                    {product.locations.length > 0 && (
                      <p className="customer-product-location">
                        {product.locations[0].label}
                        {product.locations.length > 1 && (
                          <span> +{product.locations.length - 1} more</span>
                        )}
                      </p>
                    )}
                  </div>
                </Link>
                <ShoppingListControl productId={product._id} productName={product.name} />
              </li>
            ))}
          </ul>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => updateParams({ page: page > 1 ? String(page) : "" })}
          />
        </>
      )}
    </div>
  );
}
