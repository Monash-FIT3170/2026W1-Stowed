import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products, ProductRecords } from "../../api/products/collections";
import { Sites, FloorMaps, StorageUnits, StorageLocations } from "../../api/locations/collections";
import { FilterChips } from "../components/FilterChips";
import { StatusBadge } from "../components/StatusBadge";
import "./InventoryListPage.css";
import "../Global.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export function ItemThumbnail({ photoUrl, catalogImages, images, name }) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
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
    <img src={thumbnailUrl} alt={name} onError={() => setImgError(true)} className="item-thumbnail" />
  );
}

export function InventoryListPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { items, loading, productRecords, storageLocations, storageUnits, floorMaps, sites } = useTracker(() => {
    const sub1 = Meteor.subscribe("products");
    Meteor.subscribe("productRecords");
    Meteor.subscribe("locations.all");
    return {
      items: Products.find().fetch(),
      loading: !sub1.ready(),
      productRecords: ProductRecords.find().fetch(),
      storageLocations: StorageLocations.find().fetch(),
      storageUnits: StorageUnits.find().fetch(),
      floorMaps: FloorMaps.find().fetch(),
      sites: Sites.find().fetch(),
    };
  }, []);

  // Build a short location label for each product from its ProductRecords
  function getLocationLabel(productId) {
    const records = productRecords.filter((r) => r.productId === productId);
    if (!records.length) return "—";
    // Show first location's path, + N more if multiple
    const first = records[0];
    const loc = storageLocations.find((l) => l._id === first.locationId);
    if (!loc) return "—";
    const unit = storageUnits.find((u) => u._id === loc.storageUnitId);
    const label = unit ? `${unit.name} · ${loc.name}` : loc.name;
    return records.length > 1 ? `${label} +${records.length - 1}` : label;
  }

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeFilter === "low-stock") {
      result = result.filter((item) => item.totalQuantity <= 10);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const name = (item.name || "").toLowerCase();
        const description = (item.description || "").toLowerCase();
        const sku = (item.sku || "").toLowerCase();
        const id = (item._id || "").toLowerCase();
        return name.includes(query) || description.includes(query) || sku.includes(query) || id.includes(query);
      });
    }
    return result;
  }, [items, activeFilter, searchQuery]);

  const lowStockCount = items.filter((item) => item.totalQuantity <= 10).length;

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

  const openDeleteModal = () => { if (selectedProductIds.length === 0) return; setShowDeleteModal(true); setDeleteError(""); };
  const closeDeleteModal = () => { if (isDeleting) return; setShowDeleteModal(false); setDeleteError(""); };

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
      setDeleteError(error.reason || error.message || "Could not delete selected items.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filters = [
    { id: "all", label: "All", count: items.length },
    { id: "low-stock", label: "⚠ Low stock", count: lowStockCount },
    { id: "tag", label: "Tag ▾" },
    { id: "location", label: "Location ▾" },
  ];

  if (loading) return <div className="inventory-list-container">Loading...</div>;

  return (
    <div className="inventory-list-container">
      <div className="item-detail-header">
        <div className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inventory</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">All items</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">All <em>Items</em></h1>
          <Link to="/inventory/new">
            <button className="btn-primary">+ Add item</button>
          </Link>
        </div>
      </div>

      <div style={{ padding: "0 28px 48px" }}>

        {/* Search bar */}
        <div className="search-bar-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, name, tag, or SKU"
            className="search-input"
            style={{ background: "var(--card-bg)" }}
          />
        </div>

        <FilterChips filters={filters} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

        <div className="filter-count">
          Showing {filteredItems.length} of {items.length}
          {activeFilter !== "all" && ` · Filter: ${activeFilter.replace("-", " ")}`}
        </div>

        <div className="selected-actions">
          <span>{selectedProductIds.length} selected</span>
          <button
            type="button"
            className="btn-selected-delete"
            onClick={openDeleteModal}
            disabled={selectedProductIds.length === 0}
            aria-label="Delete selected items"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="delete-icon">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Z" />
              <path d="M6 9h12l-1 11H7L6 9Zm4 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" />
            </svg>
            <span className="sr-only">Delete selected items</span>
          </button>
          <span className="selected-count">{selectedProductIds.length}</span>
        </div>

        {/* Items card */}
        {filteredItems.length === 0 ? (
          <div className="empty-state">No items match the current filters.</div>
        ) : (
          <>
            <div className="table-header">
              <span />
              <span>Item</span>
              <span>Tag</span>
              <span>Location</span>
              <span>Stock</span>
              <span>Status</span>
              <span />
            </div>
            {filteredItems.map((item) => (
              <div key={item._id} className="table-row">
                <ItemThumbnail images={item.images || item.catalogImages} photoUrl={item.photoUrl} name={item.name} />
                <span>
                  <Link to={`/inventory/${item._id}`} className="item-name-link">{item.name}</Link>
                </span>
                <span><span className="item-tag">{item.tag || "—"}</span></span>
                <span className="item-location">{getLocationLabel(item._id)}</span>
                <span>{item.totalQuantity}</span>
                <StatusBadge quantity={item.totalQuantity} threshold={10} />
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
          </>
        )}

        {showDeleteModal && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
              <h2 id="delete-product-title" className="modal-title">
                Delete {selectedItems.length} selected item{selectedItems.length !== 1 ? "s" : ""}?
              </h2>
              <p className="modal-text">
                This will permanently delete the selected product{selectedItems.length !== 1 ? "s" : ""} and remove all related location stock records.
              </p>
              {deleteError && <div className="warning-text">{deleteError}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeDeleteModal} disabled={isDeleting}>Cancel</button>
                <button type="button" className="btn-danger" onClick={handleDeleteSelectedProducts} disabled={isDeleting}>
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