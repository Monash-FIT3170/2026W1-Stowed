import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products, ProductRecords } from "../../api/products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "../../api/locations/collections";
import "./ItemDetailPage.css";
import "../Global.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function buildLocationLabel(
  locationId,
  storageLocations,
  storageUnits,
  floorMaps,
  sites,
) {
  const location = storageLocations.find((loc) => loc._id === locationId);
  if (!location) return locationId;

  const unit = storageUnits.find(
    (candidate) => candidate._id === location.storageUnitId,
  );
  const floorMap = unit
    ? floorMaps.find((candidate) => candidate._id === unit.floorMapId)
    : null;
  const site = floorMap
    ? sites.find((candidate) => candidate._id === floorMap.siteId)
    : null;

  return [site?.name, floorMap?.name, unit?.name, location.name]
    .filter(Boolean)
    .join(" → ");
}

export function ItemDetailView({
  item,
  productId,
  records = [],
  sites = [],
  floorMaps = [],
  storageUnits = [],
  storageLocations = [],
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  if (!item) {
    return <div className="p-8 text-center">Item not found.</div>;
  }

  const unitCost = Number(item.unitCost);
  const currentStock = item.currentStock ?? item.totalQuantity ?? 0;
  const reorderAt = item.reorderAt ?? 10;
  const galleryImages =
    Array.isArray(item.images) && item.images.length
      ? item.images
      : Array.isArray(item.catalogImages) && item.catalogImages.length
        ? item.catalogImages
        : item.photoUrl
          ? [item.photoUrl]
          : [];
  const qrCode = item.qrCode || item.photoUrl || "";
  const hasUnitCost = Number.isFinite(unitCost);
  const storageAssignments = records.length
    ? records.map((record) => ({
      key: record._id,
      label: buildLocationLabel(
        record.locationId,
        storageLocations,
        storageUnits,
        floorMaps,
        sites,
      ),
      quantity: record.quantity,
    }))
    : item.location
      ? [
        {
          key: "legacy-location",
          label: item.location,
          quantity: currentStock,
        },
      ]
      : [];

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await callMethod("products.delete", { productId });
      navigate("/");
    } catch (error) {
      console.error("Failed to delete product:", error);
      setIsDeleting(false);
    }
  };

  const isLowStock = item.status && item.status.includes("CRITICAL");
  const statusLabel = isLowStock ? "Low stock" : "In stock";
  const statusClass = isLowStock
    ? "panel-status-badge low"
    : "panel-status-badge ok";

  return (
    <>
      <div className="item-detail-container">
        <div className="item-detail-header">
          <div className="header-top">
            <div className="breadcrumb">
              <Link to="/inventory/list" className="breadcrumb-link">
                Inventory
              </Link>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">Item</span>
            </div>
          </div>

          <h1 className="header-title">
            Item <em>Details</em>
          </h1>

          <div className="header-content">
            <div className="header-icon-section">
              <img
                src={item.photoUrl}
                alt={item.name}
                className="header-icon"
              />
            </div>
            <div className="header-info">
              <div className={statusClass}>{statusLabel}</div>
              <h1 className="header-title">{item.name}</h1>
              <div className="header-meta">
                <span>{currentStock} in stock</span>
                <span></span>
                <span>Reorder at {reorderAt}</span>
                <span></span>
                <span className="sku">SKU: {item.sku}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="item-detail-grid">
          <div className="left-column">
            <div className="detail-section">
              <h2 className="section-title">
                <span className="section-badge id">ID</span>
                Core identification
              </h2>
              <div className="section-content">
                <div className="form-group">
                  <label>Item name</label>
                  <input
                    type="text"
                    value={item.name}
                    readOnly
                    className="form-input"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <div className="form-tag">{item.category}</div>
                  </div>
                  <div className="form-group">
                    <label>Brand</label>
                    <div className="form-tag">{item.brand}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h2 className="section-title">
                <span className="section-badge op">OP</span>
                Operational details
              </h2>
              <div className="section-content">
                <div className="form-row">
                  <div className="form-group">
                    <label>Unit cost</label>
                    <input
                      type="text"
                      value={hasUnitCost ? `$${unitCost.toFixed(2)}` : "—"}
                      readOnly
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Current stock</label>
                    <input
                      type="text"
                      value={currentStock}
                      readOnly
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Reorder at</label>
                    <input
                      type="text"
                      value={reorderAt}
                      readOnly
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <div className="form-tag">{item.location || "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h2 className="section-title">
                <span className="section-badge lc">LC</span>
                Storage locations
              </h2>
              <div className="section-content">
                {storageAssignments.length ? (
                  <div className="storage-location-list">
                    {storageAssignments.map((assignment) => (
                      <div
                        key={assignment.key}
                        className="storage-location-item"
                      >
                        <div>
                          <div className="storage-location-name">
                            {assignment.label}
                          </div>
                          <div className="storage-location-meta">
                            Assigned stock
                          </div>
                        </div>
                        <div className="storage-location-quantity">
                          {assignment.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="section-empty">
                    No stock assigned to a storage location yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="right-column">
            <div className="detail-section">
              <h2 className="section-title">
                <span className="section-badge im">IM</span>
                Visual catalogue
              </h2>
              <div className="section-content">
                <div className="main-image-container">
                  <img
                    src={galleryImages[selectedImageIndex]}
                    alt={item.name}
                    className="main-image"
                  />
                </div>
                <div className="thumbnail-gallery">
                  {galleryImages.map((img, index) => (
                    <button
                      key={index}
                      className={`thumbnail ${selectedImageIndex === index ? "active" : ""}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img src={img} alt={`${item.name} ${index + 1}`} />
                    </button>
                  ))}
                  <button className="thumbnail add-btn">+</button>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h2 className="section-title">
                <span className="section-badge qr">QR</span>
                QR & label
              </h2>
              <div className="section-content qr-section">
                <div className="qr-container">
                  <img src={qrCode} alt="QR Code" className="qr-code" />
                  <p className="qr-label">SKU: {item.sku}</p>
                  <p className="qr-label">{item.location}</p>
                </div>
                <button className="btn-print">Print label</button>
              </div>
            </div>
          </div>
        </div>

        <div className="create-product-footer">
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            Back
          </button>
          <button
            className="btn-primary"
            onClick={() => navigate(`/inventory/${productId}/edit`)}
          >
            Update
          </button>
          <button
            className="btn-danger"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Delete "{item.name}"?</h3>
            <p className="modal-text">
              This will permanently delete the product and remove it from all
              storage locations.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ItemDetailPage() {
  const { productId } = useParams();

  const {
    item,
    isLoading,
    records,
    sites,
    floorMaps,
    storageUnits,
    storageLocations,
  } = useTracker(() => {
    const handleProducts = Meteor.subscribe("products");
    const handleRecords = Meteor.subscribe("productRecords");
    const handleLocations = Meteor.subscribe("locations.all");
    return {
      isLoading:
        !handleProducts.ready() ||
        !handleRecords.ready() ||
        !handleLocations.ready(),
      item: Products.findOne(productId),
      records: ProductRecords.find(
        { productId },
        { sort: { quantity: -1 } },
      ).fetch(),
      sites: Sites.find().fetch(),
      floorMaps: FloorMaps.find().fetch(),
      storageUnits: StorageUnits.find().fetch(),
      storageLocations: StorageLocations.find().fetch(),
    };
  }, [productId]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <ItemDetailView
      item={item}
      productId={productId}
      records={records}
      sites={sites}
      floorMaps={floorMaps}
      storageUnits={storageUnits}
      storageLocations={storageLocations}
    />
  );
}
