import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { Products, ProductRecords } from "../../api/products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "../../api/locations/collections";
import { uploadImageToServer } from "/imports/api/upload";
import "./ProductDetailPage.css";
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
  sites, // kept for call-site compatibility; not used in label
) {
  const location = storageLocations.find((loc) => loc._id === locationId);
  if (!location) return locationId;

  const unit = storageUnits.find(
    (candidate) => candidate._id === location.storageUnitId,
  );
  const floorMap = unit
    ? floorMaps.find((candidate) => candidate._id === unit.floorMapId)
    : null;

  return [floorMap?.name, unit?.name, location.name]
    .filter(Boolean)
    .join(" → ");
}

export function ProductDetailView({
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
  const [imageUrls, setImageUrls] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { role } = useAuth();
  const canUpdate = hasClientPermission(role, "products.update");
  const canDelete = hasClientPermission(role, "products.delete");
  const canUploadImage = hasClientPermission(role, "products.uploadImage");
  const canRestock = hasClientPermission(role, "products.restock");

  // ── Restock modal state ──
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockQty, setRestockQty] = useState("");
  const [restockAssignments, setRestockAssignments] = useState([]);
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockError, setRestockError] = useState("");

  if (!item) {
    return <div className="p-8 text-center">Product not found.</div>;
  }

  // ── Restock helpers ──
  function openRestockModal() {
    setRestockQty("");
    setRestockAssignments(
      records.map((r) => ({ locationId: r.locationId, quantity: String(r.quantity) }))
    );
    setIsRestocking(false);
    setRestockError("");
    setShowRestockModal(true);
  }
  function addRestockAssignment() {
    setRestockAssignments((prev) => [...prev, { locationId: "", quantity: "" }]);
  }
  function removeRestockAssignment(index) {
    setRestockAssignments((prev) => prev.filter((_, i) => i !== index));
  }
  function updateRestockAssignment(index, field, value) {
    setRestockAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }
  const parsedRestockQty   = parseInt(restockQty, 10);
  const restockQtyIsValid  = restockQty !== "" && !isNaN(parsedRestockQty) && parsedRestockQty > 0;
  const currentStock = item.currentStock ?? item.totalQuantity ?? 0;
  const restockTargetTotal = restockQtyIsValid ? currentStock + parsedRestockQty : null;
  const validRestockAssignments = restockAssignments.filter((a) => a.locationId && a.quantity !== "");
  const restockAssignedTotal = validRestockAssignments.reduce((sum, a) => sum + parseInt(a.quantity, 10), 0);
  const restockRemaining   = restockTargetTotal !== null ? restockTargetTotal - restockAssignedTotal : null;
  const restockIsBalanced  = restockTargetTotal !== null && restockRemaining === 0;
  const restockCanSubmit   = restockQtyIsValid && restockIsBalanced;

  async function confirmRestock() {
    setIsRestocking(true);
    setRestockError("");
    try {
      await callMethod("products.restock", {
        productId,
        additionalQuantity: parsedRestockQty,
        assignments: validRestockAssignments.map((a) => ({
          locationId: a.locationId,
          quantity:   parseInt(a.quantity, 10),
        })),
      });
      setShowRestockModal(false);
    } catch (err) {
      setRestockError(err.reason || err.message || "Restock failed.");
      setIsRestocking(false);
    }
  }

  const unitCost = Number(item.unitCost);
  const reorderAt = item.reorderAt ?? null;
  const galleryImages =
    imageUrls.length > 0
      ? imageUrls
      : Array.isArray(item.images) && item.images.length
        ? item.images
        : Array.isArray(item.catalogImages) && item.catalogImages.length
          ? item.catalogImages
          : item.photoUrl
            ? [item.photoUrl]
            : [];
  // For each gallery image, determine whether it originates from the
  // uploaded images (so it can be removed). We treat `imageUrls` (current
  // edited/uploaded images) and `item.images` (persisted uploads) as
  // removable sources. Fallback `photoUrl` or `catalogImages` are not removable.
  const removableFlags = galleryImages.map((img) => {
    if (imageUrls.length > 0) return imageUrls.includes(img);
    if (Array.isArray(item.images) && item.images.length) return item.images.includes(img);
    return false;
  });
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

  useEffect(() => {
    const initialImages =
      item?.images?.length
        ? item.images
        : Array.isArray(item.catalogImages) && item.catalogImages.length
          ? item.catalogImages
          : item.photoUrl
            ? [item.photoUrl]
            : [];
    setImageUrls(initialImages);
    if (initialImages.length > 0) {
      setSelectedImageIndex(0);
    }
  }, [item]);

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

  function imagesHaveChanged() {
    const sourceImages =
      item?.images?.length
        ? item.images
        : Array.isArray(item.catalogImages) && item.catalogImages.length
          ? item.catalogImages
          : item.photoUrl
            ? [item.photoUrl]
            : [];
    if (sourceImages.length !== imageUrls.length) return true;
    return imageUrls.some((url, index) => url !== sourceImages[index]);
  }

  async function saveImageChanges() {
    if (!imagesHaveChanged()) return;
    try {
      await callMethod("products.setImages", {
        productId,
        images: imageUrls,
      });
    } catch (error) {
      console.error("Failed to save product images:", error);
      throw error;
    }
  }

  async function handleUpdateClick() {
    if (imagesHaveChanged()) {
      await saveImageChanges();
    }
    navigate(`/inventory/${productId}/edit`);
  }

  async function handleImageSelect(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }

    setUploadError("");
    setUploadingImage(true);
    try {
      const url = await uploadImageToServer(file);
      let nextImages;
      setImageUrls((prev) => {
        const next = [...prev, url];
        nextImages = next;
        if (prev.length === 0) {
          setSelectedImageIndex(0);
        }
        return next;
      });

      // Auto-save uploaded image list to server so it appears in lists.
      try {
        await callMethod("products.setImages", { productId, images: nextImages });
      } catch (err) {
        console.error("Failed to auto-save uploaded images:", err);
      }
    } catch (error) {
      console.error("Image upload failed:", error);
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage(index) {
    setImageUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSelectedImageIndex((current) => {
        if (index === current) return 0;
        if (index < current) return current - 1;
        return current;
      });
      return next;
    });
  }

  const isLowStock = item.status && item.status.includes("CRITICAL");
  const statusLabel = isLowStock ? "Low stock" : "In stock";
  const statusClass = isLowStock
    ? "panel-status-badge low"
    : "panel-status-badge ok";

  return (
    <>
      <div className="product-detail-container">
        <div className="product-detail-header">
          <div className="header-top">
            <div className="breadcrumb">
              <Link to="/inventory/list" className="breadcrumb-link">
                Inventory
              </Link>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">Product</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn-secondary" onClick={() => navigate("/inventory/list")}>
                Back
              </button>
              {canRestock && (
                <button className="btn-secondary" onClick={openRestockModal}>
                  Restock
                </button>
              )}
              {canUpdate && (
                <button
                  className="btn-primary"
                  onClick={handleUpdateClick}
                  disabled={uploadingImage}
                >
                  Update
                </button>
              )}
              {canDelete && (
                <button
                  className="btn-danger"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <h1 className="header-title">
            Product <em>Details</em>
          </h1>

          <div className="header-content">
            <div className="header-icon-section">
              {galleryImages.length > 0 ? (
                <img className="header-icon" src={galleryImages[0]} alt="Product" />
              ) : (
                <div className="header-icon header-icon-placeholder">No photo</div>
              )}
            </div>
            <div className="header-info">
              <div className={statusClass}>{statusLabel}</div>
              <h1 className="header-title">{item.name}</h1>
              <div className="header-meta">
                <span>{currentStock} in stock</span>
                <span></span>
                <span>{reorderAt != null ? `Reorder at ${reorderAt}` : "No reorder threshold"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="product-detail-grid">
          <div className="left-column">
            <div className="detail-section">
              <h2 className="section-title">
                <span className="section-badge id">ID</span>
                Core identification
              </h2>
              <div className="section-content">
                <div className="form-group">
                  <label htmlFor="product-name">Product name</label>
                  <input
                    id="product-name"
                    type="text"
                    value={item.name}
                    readOnly
                    className="form-input"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <div className="form-tag">{item.category || "—"}</div>
                  </div>
                  <div className="form-group">
                    <label>Brand</label>
                    <div className="form-tag">{item.brand || "—"}</div>
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
                    <label htmlFor="unit-cost">Unit cost</label>
                    <input
                      id="unit-cost"
                      type="text"
                      value={hasUnitCost ? `$${unitCost.toFixed(2)}` : "-"}
                      readOnly
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="current-stock">Current stock</label>
                    <input
                      id="current-stock"
                      type="text"
                      value={currentStock}
                      readOnly
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="reorder-at">Reorder at</label>
                    <input
                      id="reorder-at"
                      type="text"
                      value={reorderAt != null ? reorderAt : "Not set"}
                      readOnly
                      className="form-input"
                    />
                  </div>
                  {/* <div className="form-group">
                    <label>Location</label>
                    <div className="form-tag">{item.location || "-"}</div>
                  </div> */}
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
                  {galleryImages.length > 0 ? (
                    <img
                      src={galleryImages[selectedImageIndex]}
                      alt={item.name}
                      className="main-image"
                    />
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                      {uploadingImage ? "Uploading..." : "No image uploaded"}
                    </span>
                  )}
                </div>
                <div className="thumbnail-gallery">
                  {galleryImages.map((img, index) => (
                    <div key={index} className="thumbnail-wrapper">
                      <button
                        type="button"
                        className={`thumbnail ${selectedImageIndex === index ? "active" : ""}`}
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img src={img} alt={`${item.name} ${index + 1}`} />
                      </button>
                      {removableFlags[index] && (
                        <button
                          type="button"
                          className="thumbnail-remove"
                          onClick={() => removeImage(index)}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {canUploadImage && (
                    <>
                      <button
                        type="button"
                        className="thumbnail add-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? "..." : "+"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        style={{ display: "none" }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ── RESTOCK MODAL ── */}
      {showRestockModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "480px", width: "100%" }}>
            <h3 className="modal-title">Restock "{item.name}"</h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
              Current stock: <strong>{currentStock}</strong>. Enter units being added, then
              redistribute <em>all</em> stock across locations.
            </p>

            {/* Units being added */}
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ fontWeight: 600, fontSize: "13px" }}>Units being added</label>
              <input
                type="number"
                min="1"
                className="form-input"
                style={{ maxWidth: "140px", marginTop: "4px" }}
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                disabled={isRestocking}
              />
              {restockTargetTotal !== null && (
                <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                  New total will be <strong>{restockTargetTotal}</strong> units.
                </p>
              )}
            </div>

            {/* Location assignments */}
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
              <p style={{ fontWeight: 600, fontSize: "13px", marginBottom: "10px" }}>
                Assign all stock to locations
              </p>
              {restockAssignments.map((assignment, index) => {
                const usedElsewhere = new Set(
                  restockAssignments.filter((_, i) => i !== index).map((a) => a.locationId).filter(Boolean)
                );
                return (
                  <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <select
                      className="form-input"
                      style={{ flex: 2 }}
                      value={assignment.locationId}
                      onChange={(e) => updateRestockAssignment(index, "locationId", e.target.value)}
                      disabled={isRestocking}
                    >
                      <option value="">Select a location…</option>
                      {storageLocations
                        .filter((loc) => !usedElsewhere.has(loc._id))
                        .map((loc) => (
                          <option key={loc._id} value={loc._id}>
                            {buildLocationLabel(loc._id, storageLocations, storageUnits, floorMaps, sites)}
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      className="form-input"
                      style={{ maxWidth: "80px" }}
                      value={assignment.quantity}
                      onChange={(e) => updateRestockAssignment(index, "quantity", e.target.value)}
                      disabled={isRestocking}
                    />
                    <button type="button" className="btn-secondary" onClick={() => removeRestockAssignment(index)} disabled={isRestocking}>
                      Remove
                    </button>
                  </div>
                );
              })}
              <button type="button" className="btn-secondary" style={{ marginTop: "4px" }} onClick={addRestockAssignment} disabled={isRestocking}>
                + Add Location
              </button>

              {restockRemaining !== null && (
                <p style={{ marginTop: "10px", fontSize: "12px", fontStyle: "italic", color: restockRemaining === 0 ? "var(--success)" : "var(--text-muted)" }}>
                  {restockRemaining === 0 && `All ${restockTargetTotal} units assigned.`}
                  {restockRemaining  > 0 && `${restockAssignedTotal} of ${restockTargetTotal} assigned — ${restockRemaining} remaining.`}
                  {restockRemaining  < 0 && `Over-assigned by ${Math.abs(restockRemaining)} unit${Math.abs(restockRemaining) !== 1 ? "s" : ""}.`}
                </p>
              )}
            </div>

            {restockError && (
              <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--danger, #b91c1c)" }}>{restockError}</p>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowRestockModal(false)} disabled={isRestocking}>
                Cancel
              </button>
              <button className="btn-primary" onClick={confirmRestock} disabled={!restockCanSubmit || isRestocking}>
                {isRestocking ? "Saving…" : "Confirm Restock"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ProductDetailPage() {
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
    <ProductDetailView
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
