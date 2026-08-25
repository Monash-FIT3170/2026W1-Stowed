import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { Products, ProductRecords } from "../../api/products/collections";
import { ProductCategories } from "/imports/api/categories/collections";
import { StorageUnits, StorageLocations } from "../../api/locations/collections";
import { FilterChips } from "../components/FilterChips";
import { StatusBadge } from "../components/StatusBadge";
import "./InventoryListPage.css";
import "../Global.css";
import {
  searchProducts,
  filterLowStock,
  filterOutOfStock,
  filterByStorageUnit,
  filterByCategory,
} from "../../api/products/filters";

const NO_LOCATIONS = "No locations";

// One source of truth for the chips and for the ?filter= values accepted from
// the URL. Kept as separate lists, a newly added chip renders but is rejected by
// the guard below, which silently drops the page back to "all".
export const INVENTORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "low-stock", label: "⚠ Low stock" },
  { id: "out-of-stock", label: "Out of stock" },
  { id: "category", label: "Category ▾" },
  { id: "location", label: "Location ▾" },
];

const INVENTORY_FILTER_IDS = new Set(INVENTORY_FILTERS.map((filter) => filter.id));

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export function ProductThumbnail({ photoUrl, catalogImages, images, name }) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  const thumbnailUrls = [
    ...(Array.isArray(images) ? images : []),
    photoUrl,
    ...(Array.isArray(catalogImages) ? catalogImages : []),
  ].filter((u, i, arr) => Boolean(u) && arr.indexOf(u) === i);

  const thumbnailUrl = thumbnailUrls[0] || "";

  if (!thumbnailUrl || imgError) {
    return <div className="item-thumbnail">{initials}</div>;
  }

  return (
    <img
      src={thumbnailUrl}
      alt={name}
      onError={() => setImgError(true)}
      className="item-thumbnail"
    />
  );
}

export function InventoryListPage() {
  const { role } = useAuth();
  const canDelete = hasClientPermission(role, "products.delete");
  const canCreate = hasClientPermission(role, "products.create");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get("filter");
  const activeFilter = INVENTORY_FILTER_IDS.has(requestedFilter) ? requestedFilter : "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  const [deleteError, setDeleteError] = useState("");
  const [locationFilterUnitId, setLocationFilterUnitId] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState("");

  const { items, loading, productRecords, categories, storageLocations, storageUnits } =
    useTracker(() => {
      const sub1 = Meteor.subscribe("products");
      Meteor.subscribe("productRecords");
      Meteor.subscribe("productCategories");
      Meteor.subscribe("locations.all");
      return {
        items: Products.find().fetch(),
        loading: !sub1.ready(),
        productRecords: ProductRecords.find().fetch(),
        categories: ProductCategories.find().fetch(),
        storageLocations: StorageLocations.find().fetch(),
        storageUnits: StorageUnits.find().fetch(),
      };
    }, []);

  // Products store only a categoryId, so resolve names once per render pass
  // rather than scanning the category list for every row.
  const categoryNameById = useMemo(
    () => new Map(categories.map((cat) => [cat._id, cat.name])),
    [categories],
  );

  function getLocationLabel(productId) {
    const records = productRecords.filter((r) => r.productId === productId);
    // Nothing stored anywhere, or every record points at a location that no
    // longer exists: say so rather than leaving the cell looking empty.
    if (!records.length) return NO_LOCATIONS;

    // Lead with the location holding the most stock, not whichever record the
    // collection happened to return first. Records are merged per location
    // when they are written, so there is one record per location here.
    const ranked = [...records].sort((a, b) => b.quantity - a.quantity);
    const primary = ranked.find((r) => storageLocations.some((l) => l._id === r.locationId));
    if (!primary) return NO_LOCATIONS;

    const loc = storageLocations.find((l) => l._id === primary.locationId);
    const unit = storageUnits.find((u) => u._id === loc.storageUnitId);
    const label = unit ? `${unit.name} · ${loc.name}` : loc.name;

    const otherCount = records.length - 1;
    if (otherCount < 1) return label;

    return (
      <>
        {label}
        <Link to={`/inventory/${productId}`} className="item-location-more">
          and {otherCount} other location{otherCount === 1 ? "" : "s"}
        </Link>
      </>
    );
  }

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeFilter === "low-stock") {
      result = filterLowStock(result);
    }
    if (activeFilter === "out-of-stock") {
      result = filterOutOfStock(result);
    }
    if (activeFilter === "category") {
      result = filterByCategory(result, categoryFilterId);
    }
    if (activeFilter === "location") {
      result = filterByStorageUnit(result, productRecords, storageLocations, locationFilterUnitId);
    }
    result = searchProducts(result, searchQuery);
    return result;
  }, [
    items,
    activeFilter,
    searchQuery,
    categoryFilterId,
    locationFilterUnitId,
    storageLocations,
    productRecords,
  ]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pagedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const lowStockCount = filterLowStock(items).length;
  const outOfStockCount = filterOutOfStock(items).length;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedProductIds.includes(item._id)),
    [items, selectedProductIds],
  );

  const toggleSelectedProduct = (productId) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const openDeleteModal = () => {
    if (selectedProductIds.length === 0) return;
    setShowDeleteModal(true);
    setDeleteError("");
  };
  const closeDeleteModal = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
    setDeleteError("");
  };

  const handleDeleteSelectedProducts = async () => {
    if (selectedProductIds.length === 0) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      for (const productId of selectedProductIds) {
        await callMethod("products.delete", { productId });
      }
      setSelectedProductIds([]);
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete selected products:", error);
      setDeleteError(error.reason || error.message || "Could not delete selected products.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filterCounts = {
    all: items.length,
    "low-stock": lowStockCount,
    "out-of-stock": outOfStockCount,
  };
  const filters = INVENTORY_FILTERS.map((filter) => ({
    ...filter,
    count: filterCounts[filter.id],
  }));

  const handleFilterChange = (filter) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (filter === "all") {
      nextSearchParams.delete("filter");
    } else {
      nextSearchParams.set("filter", filter);
    }
    setSearchParams(nextSearchParams);
    setCurrentPage(1);
    if (filter !== "location") setLocationFilterUnitId("");
    if (filter !== "category") setCategoryFilterId("");
  };

  if (loading) return <div className="inventory-list-container">Loading...</div>;

  return (
    <div className="inventory-list-container">
      <div className="product-detail-header">
        <div className="header-top">
          <h1 className="header-title">
            All <em>Products</em>
          </h1>
          {canCreate && (
            <Link to="/inventory/new">
              <button className="btn-primary">+ Add product</button>
            </Link>
          )}
        </div>
      </div>

      <div className="inventory-list-body">
        <div className="search-bar-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by ID, name, or SKU"
            className="search-input"
            style={{ background: "var(--card-bg)" }}
          />
        </div>

        <FilterChips
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />

        {activeFilter === "category" && (
          <div style={{ marginBottom: "12px" }}>
            <select
              value={categoryFilterId}
              onChange={(e) => {
                setCategoryFilterId(e.target.value);
                setCurrentPage(1);
              }}
              className="form-input"
              style={{ maxWidth: "360px", background: "var(--card-bg)" }}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeFilter === "location" && (
          <div style={{ marginBottom: "12px" }}>
            <select
              value={locationFilterUnitId}
              onChange={(e) => {
                setLocationFilterUnitId(e.target.value);
                setCurrentPage(1);
              }}
              className="form-input"
              style={{ maxWidth: "360px", background: "var(--card-bg)" }}
            >
              <option value="">All locations</option>
              {storageUnits.map((unit) => (
                <option key={unit._id} value={unit._id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="empty-state">No products match the current filters.</div>
        ) : (
          <>
            <div className="detail-section">
              <div className="inventory-list-heading">
                <div className="inventory-list-title">Inventory List</div>
                <div className="inventory-list-subtitle">
                  {filteredItems.length} of {items.length} products shown
                </div>
              </div>
              {canDelete && (
                <div className="selected-actions">
                  <span>{selectedProductIds.length} selected</span>
                  <button
                    type="button"
                    className="btn-selected-delete"
                    onClick={openDeleteModal}
                    disabled={selectedProductIds.length === 0}
                    aria-label="Delete selected products"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="delete-icon">
                      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Z" />
                      <path d="M6 9h12l-1 11H7L6 9Zm4 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" />
                    </svg>
                    <span className="sr-only">Delete selected products</span>
                  </button>
                  <span className="selected-count">{selectedProductIds.length}</span>
                </div>
              )}
              <div className="table-header">
                <span />
                <span>Product</span>
                <span>Category</span>
                <span>Location</span>
                <span>Stock</span>
                <span>Status</span>
                <span />
                <span />
              </div>
              {pagedItems.map((item) => (
                <div key={item._id} className="table-row">
                  <ProductThumbnail
                    images={item.images || item.catalogImages}
                    photoUrl={item.photoUrl}
                    name={item.name}
                  />
                  <span>
                    <Link to={`/inventory/${item._id}`} className="item-name-link">
                      {item.name}
                    </Link>
                  </span>
                  <span>
                    <span className="item-category">
                      {categoryNameById.get(item.categoryId) || "-"}
                    </span>
                  </span>
                  <span className="item-location">{getLocationLabel(item._id)}</span>
                  <span>{item.totalQuantity}</span>
                  <StatusBadge quantity={item.totalQuantity} threshold={item.reorderAt ?? null} />
                  <Link to={`/inventory/${item._id}`} className="item-view-more">
                    View more
                  </Link>
                  <label className="row-select">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(item._id)}
                      onChange={() => toggleSelectedProduct(item._id)}
                      aria-label={`Select ${item.name}`}
                    />
                  </label>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "12px",
                  justifyContent: "center",
                }}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      border: page === currentPage ? "none" : "1px solid var(--border-subtle)",
                      background: page === currentPage ? "var(--accent-primary)" : "var(--card-bg)",
                      color: page === currentPage ? "#fff" : "var(--text-muted)",
                      fontWeight: page === currentPage ? 700 : 400,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {showDeleteModal && (
          <div className="modal-overlay" role="presentation">
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-product-title"
            >
              <h2 id="delete-product-title" className="modal-title">
                Delete {selectedItems.length} selected item
                {selectedItems.length !== 1 ? "s" : ""}?
              </h2>
              <p className="modal-text">
                This will permanently delete the selected product
                {selectedItems.length !== 1 ? "s" : ""} and remove all related location stock
                records.
              </p>
              {deleteError && <div className="warning-text">{deleteError}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDeleteSelectedProducts}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete selected"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
