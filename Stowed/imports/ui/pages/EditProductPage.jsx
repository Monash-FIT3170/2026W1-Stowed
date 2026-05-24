import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products, ProductRecords } from "/imports/api/products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "/imports/api/locations/collections";
import { uploadImageToServer } from "/imports/api/upload";
import "./CreateProductPage.css";
import "../Global.css";

// Wraps Meteor.call in a Promise so we can use async/await.
function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function buildLocationLabel(location, storageUnits, floorMaps, sites) {
  const unit = storageUnits.find((u) => u._id === location.storageUnitId);
  const floorMap = unit ? floorMaps.find((f) => f._id === unit.floorMapId) : null;
  const site = floorMap ? sites.find((s) => s._id === floorMap.siteId) : null;
  return [site?.name, floorMap?.name, unit?.name, location.name]
    .filter(Boolean)
    .join(" → ");
}

export function EditProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [initialised, setInitialised] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [imageUrls, setImageUrls] = useState([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const { loading, product, originalRecords, sites, floorMaps, storageUnits, storageLocations } =
    useTracker(() => {
      const subProducts = Meteor.subscribe("products");
      const subRecords = Meteor.subscribe("productRecords");
      const subLocations = Meteor.subscribe("locations.all");
      const loading = !subProducts.ready() || !subRecords.ready() || !subLocations.ready();
      return {
        loading,
        product: Products.findOne(productId),
        originalRecords: ProductRecords.find({ productId }, { sort: { quantity: -1 } }).fetch(),
        sites: Sites.find().fetch(),
        floorMaps: FloorMaps.find().fetch(),
        storageUnits: StorageUnits.find().fetch(),
        storageLocations: StorageLocations.find().fetch(),
      };
    }, [productId]);

  useEffect(() => {
    if (!loading && product && !initialised) {
      setName(product.name);
      setCategory(product.category);
      setBrand(product.brand);
      setTotalQuantity(String(product.totalQuantity));
      setUnitCost(String(product.unitCost));
      setImageUrls(product.images || product.imageUrls || product.catalogImages || []);
      setMainImageIndex(product.mainImageIndex || 0);
      setAssignments(
        originalRecords.map((r) => ({
          locationId: r.locationId,
          quantity: String(r.quantity),
        })),
      );
      setInitialised(true);
    }
  }, [loading, product, originalRecords, initialised]);

  const parsedTotal = parseInt(totalQuantity, 10);
  const nameIsValid = name.trim().length > 0;
  const totalQuantityIsValid = totalQuantity !== "" && !isNaN(parsedTotal);

  const validAssignments = assignments.filter((a) => a.locationId && a.quantity !== "");
  const assignedTotal = validAssignments.reduce((sum, a) => sum + parseInt(a.quantity, 10), 0);
  const remaining = totalQuantityIsValid ? parsedTotal - assignedTotal : null;
  const isBalanced = totalQuantityIsValid && remaining === 0;
  const canSave = nameIsValid && totalQuantityIsValid && isBalanced;

  const changes = useMemo(() => {
    if (!initialised || !product) return {};
    const result = {};

    if (name.trim() !== product.name)
      result.name = { from: product.name, to: name.trim() };
    if (category !== (product.category || ""))
      result.category = { from: product.category || "", to: category };
    if (brand !== (product.brand || ""))
      result.brand = { from: product.brand || "", to: brand };
    if (parsedTotal !== product.totalQuantity)
      result.totalQuantity = { from: product.totalQuantity, to: parsedTotal };
    if (parseFloat(unitCost) !== product.unitCost)
      result.unitCost = { from: product.unitCost, to: parseFloat(unitCost) };

    const originalImages = product.images || product.imageUrls || product.catalogImages || [];
    const imagesChanged =
      imageUrls.length !== originalImages.length ||
      imageUrls.some((url, i) => url !== originalImages[i]);
    if (imagesChanged) result.images = { from: originalImages, to: imageUrls };

    const normalise = (arr) =>
      [...arr].sort((a, b) => a.locationId.localeCompare(b.locationId));
    const currentNorm = normalise(
      validAssignments.map((a) => ({ locationId: a.locationId, quantity: parseInt(a.quantity, 10) })),
    );
    const originalNorm = normalise(
      originalRecords.map((r) => ({ locationId: r.locationId, quantity: r.quantity })),
    );
    const assignmentsChanged =
      currentNorm.length !== originalNorm.length ||
      currentNorm.some(
        (a, i) => a.locationId !== originalNorm[i].locationId || a.quantity !== originalNorm[i].quantity,
      );
    if (assignmentsChanged) result.assignments = true;

    return result;
  }, [initialised, product, name, category, brand, parsedTotal, unitCost, imageUrls, validAssignments, originalRecords]);

  function addAssignment() {
    setAssignments([...assignments, { locationId: "", quantity: "" }]);
  }
  function removeAssignment(index) {
    setAssignments(assignments.filter((_, i) => i !== index));
  }
  function updateAssignment(index, field, value) {
    setAssignments(assignments.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
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
      setImageUrls((prev) => {
        const next = [...prev, url];
        if (prev.length === 0) setMainImageIndex(0);
        return next;
      });
    } catch (error) {
      console.error("Image upload failed:", error);
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage(index) {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    setMainImageIndex((current) => {
      if (index === current) return 0;
      if (index < current) return current - 1;
      return current;
    });
  }

  function handleSave() {
    if (Object.keys(changes).length === 0) {
      navigate(`/inventory/${productId}`);
      return;
    }
    setShowSaveModal(true);
  }

  async function confirmSave() {
    setIsSaving(true);
    try {
      await callMethod("products.update", {
        productId,
        name: name.trim(),
        category,
        brand,
        totalQuantity: parsedTotal,
        unitCost: unitCost ? parseFloat(unitCost) : 0,
        images: imageUrls,
        assignments: validAssignments.map((a) => ({
          locationId: a.locationId,
          quantity: parseInt(a.quantity, 10),
        })),
      });
      navigate(`/inventory/${productId}`);
    } catch (error) {
      console.error("Failed to update product:", error);
      setIsSaving(false);
    }
  }

  if (loading || !initialised) return <div className="p-8 text-center">Loading…</div>;
  if (!product) return <div className="p-8 text-center">Product not found.</div>;

  return (
    <div className="item-detail-container">
      <div className="item-detail-header">
        <div className="breadcrumb">
          <Link to="/inventory/list" className="breadcrumb-link">Inventory</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to={`/inventory/${productId}`} className="breadcrumb-link">Item</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Edit</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Edit <em>{name}</em></h1>
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="form-input"
                  />
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
                  <label>Total stock</label>
                  <input
                    type="number"
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(e.target.value)}
                    className="form-input"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Unit cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="form-input"
                    placeholder="$0.00"
                  />
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
              <p style={{ marginBottom: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
                All stock must be assigned before saving.
              </p>

              {assignments.map((assignment, index) => (
                <div
                  key={index}
                  style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}
                >
                  <select
                    value={assignment.locationId}
                    onChange={(e) => updateAssignment(index, "locationId", e.target.value)}
                    className="form-input"
                    style={{ flex: 2 }}
                  >
                    <option value="">Select a location…</option>
                    {storageLocations.map((location) => (
                      <option key={location._id} value={location._id}>
                        {buildLocationLabel(location, storageUnits, floorMaps, sites)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={assignment.quantity}
                    onChange={(e) => updateAssignment(index, "quantity", e.target.value)}
                    className="form-input"
                    style={{ maxWidth: "80px" }}
                  />

                  <button
                    type="button"
                    onClick={() => removeAssignment(index)}
                    className="btn-secondary"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button type="button" onClick={addAssignment} className="btn-secondary" style={{ marginTop: "12px" }}>
                + Add Location
              </button>

              {remaining !== null && (
                <p className="warning-text" style={{ marginTop: "12px" }}>
                  {remaining === 0 && `All ${parsedTotal} units assigned.`}
                  {remaining > 0 && `${assignedTotal} of ${parsedTotal} assigned — ${remaining} remaining.`}
                  {remaining < 0 && `Over-assigned by ${Math.abs(remaining)} unit${Math.abs(remaining) !== 1 ? "s" : ""}.`}
                </p>
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
                {imageUrls.length > 0 ? (
                  <img
                    src={imageUrls[mainImageIndex]}
                    alt="Product preview"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {uploadingImage ? "Uploading..." : "No image uploaded"}
                  </span>
                )}
              </div>

              <div className="thumbnail-gallery">
                {imageUrls.map((url, index) => (
                  <div key={url} style={{ position: "relative", display: "inline-block" }}>
                    <button
                      type="button"
                      className={`thumbnail ${index === mainImageIndex ? "active" : ""}`}
                      onClick={() => setMainImageIndex(index)}
                      title="Set as main image"
                    >
                      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      title="Remove image"
                      style={{
                        position: "absolute",
                        top: "-6px",
                        right: "-6px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--card-bg)",
                        cursor: "pointer",
                        fontSize: "11px",
                        lineHeight: "1",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

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
              </div>

              {uploadError && (
                <p className="warning-text" style={{ marginTop: "8px" }}>{uploadError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="create-product-footer">
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Save confirmation modal */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">Save changes?</h2>
            <p className="modal-text">The following fields will be updated:</p>

            <div style={{ marginBottom: "16px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {changes.name && (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-dark)", marginBottom: "2px" }}>Name</div>
                  <div style={{ color: "var(--text-muted)" }}>{changes.name.from} → {changes.name.to}</div>
                </div>
              )}
              {changes.category && (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-dark)", marginBottom: "2px" }}>Category</div>
                  <div style={{ color: "var(--text-muted)" }}>{changes.category.from} → {changes.category.to}</div>
                </div>
              )}
              {changes.brand && (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-dark)", marginBottom: "2px" }}>Brand</div>
                  <div style={{ color: "var(--text-muted)" }}>{changes.brand.from} → {changes.brand.to}</div>
                </div>
              )}
              {changes.totalQuantity && (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-dark)", marginBottom: "2px" }}>Total quantity</div>
                  <div style={{ color: "var(--text-muted)" }}>{changes.totalQuantity.from} → {changes.totalQuantity.to}</div>
                </div>
              )}
              {changes.unitCost && (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-dark)", marginBottom: "2px" }}>Unit cost</div>
                  <div style={{ color: "var(--text-muted)" }}>${changes.unitCost.from} → ${changes.unitCost.to}</div>
                </div>
              )}
              {changes.images && (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-dark)", marginBottom: "2px" }}>Images</div>
                  <div style={{ color: "var(--text-muted)" }}>
                    {changes.images.from.length} image{changes.images.from.length !== 1 ? "s" : ""} →{" "}
                    {changes.images.to.length} image{changes.images.to.length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
              {changes.assignments && (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-dark)", marginBottom: "6px" }}>Storage locations</div>
                  {validAssignments.map((a, i) => {
                    const loc = storageLocations.find((l) => l._id === a.locationId);
                    const label = loc ? buildLocationLabel(loc, storageUnits, floorMaps, sites) : a.locationId;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "4px" }}>
                        <span>{label}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-dark)" }}>{a.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" disabled={isSaving} onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={isSaving} onClick={confirmSave}>
                {isSaving ? "Saving…" : "Confirm save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}