import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { Products } from "/imports/api/products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "/imports/api/locations/collections";
import "./CreateProductPage.css";
import "../Global.css";
import { uploadImageToServer } from "/imports/api/upload";

const inputStyle = {
  padding: "6px 8px",
  border: "1px solid #999",
  borderRadius: "3px",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
};

const buttonStyle = {
  padding: "6px 14px",
  border: "1px solid #333",
  borderRadius: "3px",
  cursor: "pointer",
  background: "transparent",
  fontSize: "14px",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  marginBottom: "16px",
};

const sectionStyle = {
  borderTop: "1px solid #ccc",
  marginTop: "24px",
  paddingTop: "16px",
};

const assignmentRowStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  marginBottom: "8px",
};

const warningStyle = {
  marginTop: "4px",
  fontStyle: "italic",
  fontSize: "13px",
};

// Helpers

// Wraps Meteor.call in a Promise so we can use async/await.
function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

// Builds a full readable path for a StorageLocation, e.g.:
// "Main Warehouse → Ground Floor → Shelf A → Bay 1"
function buildLocationLabel(location, storageUnits, floorMaps, sites) {
  const unit = storageUnits.find((u) => u._id === location.storageUnitId);
  const floorMap = unit
    ? floorMaps.find((f) => f._id === unit.floorMapId)
    : null;
  const site = floorMap ? sites.find((s) => s._id === floorMap.siteId) : null;

  return [site?.name, floorMap?.name, unit?.name, location.name]
    .filter(Boolean)
    .join(" → ");
}

// Component

export function CreateProductPage() {
  const navigate = useNavigate();
  const { role } = useAuth();

  useEffect(() => {
    if (role !== null && !hasClientPermission(role, "products.create")) {
      navigate("/inventory/list", { replace: true });
    }
  }, [role, navigate]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [reorderAt, setReorderAt] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const { products, sites, floorMaps, storageUnits, storageLocations } =
    useTracker(() => {
      Meteor.subscribe("products");
      Meteor.subscribe("locations.all");
      return {
        products: Products.find().fetch(),
        sites: Sites.find().fetch(),
        floorMaps: FloorMaps.find().fetch(),
        storageUnits: StorageUnits.find().fetch(),
        storageLocations: StorageLocations.find().fetch(),
      };
    }, []);

  // Derived validation

  const parsedTotal = parseInt(totalQuantity, 10);

  const nameIsValid = name.trim().length > 0;
  const totalQuantityIsValid = totalQuantity !== "" && !isNaN(parsedTotal);

  // Case-insensitive check against all existing product names.
  const isDuplicate =
    nameIsValid &&
    products.some(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  // Only count rows that have both a location and a quantity filled in.
  const validAssignments = assignments.filter(
    (a) => a.locationId && a.quantity !== "",
  );
  const assignedTotal = validAssignments.reduce(
    (sum, a) => sum + parseInt(a.quantity, 10),
    0,
  );
  const remaining = totalQuantityIsValid ? parsedTotal - assignedTotal : null;
  const isBalanced = totalQuantityIsValid && remaining === 0;

  const canSubmit =
    nameIsValid && totalQuantityIsValid && isBalanced && !isDuplicate;

  // Assignment handlers

  function addAssignment() {
    setAssignments([...assignments, { locationId: "", quantity: "" }]);
  }

  function removeAssignment(index) {
    setAssignments(assignments.filter((_, i) => i !== index));
  }

  function updateAssignment(index, field, value) {
    setAssignments(
      assignments.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }

  async function handleImageSelect(event) {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires onChange.
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
        // If this is the first image, make it the main one.
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

  // Submit

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await callMethod("products.createWithAssignments", {
        name,
        description,
        category,
        brand,
        unitCost: unitCost ? parseFloat(unitCost) : undefined,
        totalQuantity: parsedTotal,
        reorderAt: reorderAt ? parseInt(reorderAt, 10) : undefined,
        images: imageUrls,
        assignments: validAssignments.map((a) => ({
          locationId: a.locationId,
          quantity: parseInt(a.quantity, 10),
        })),
      });

      navigate("/inventory/list");
    } catch (error) {
      console.error("Failed to create product:", error);
    }
  }

  const locationsExist = storageLocations.length > 0;

  // Render

  return (
    <>
      <div className="product-detail-container">
        <div className="product-detail-header">
          <div className="header-top">
            <div className="breadcrumb">
              <span className="breadcrumb-link">Inventory</span>
              {" "}&nbsp;/{" "}&nbsp;
              <span className="breadcrumb-current">Create product</span>
            </div>
          </div>
          <h1 className="header-title">
            Create <em>Product</em>
          </h1>
        </div>

        <div className="product-detail-grid">
          <div className="left-column">
            {/* Core identification */}
            <div className="detail-section">
              <div className="section-title">
                <span
                  className="section-badge"
                  style={{ background: "#d6ede8", color: "#4a8c78" }}
                >
                  ID
                </span>
                Core identification
              </div>
              <div className="section-content">
                <div className="form-group">
                  <label>Product name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    placeholder="e.g. AAA Battery Pack"
                  />
                  {isDuplicate && (
                    <span className="warning-text">
                      A product with this name already exists.
                    </span>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="form-input"
                      placeholder="e.g. electrical"
                    />
                  </div>
                  <div className="form-group">
                    <label>Brand</label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="form-input"
                      placeholder="e.g. Duracell"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Operational details */}
            <div className="detail-section">
              <div className="section-title">
                <span
                  className="section-badge"
                  style={{ background: "#fde8d8", color: "#b5532a" }}
                >
                  OP
                </span>
                Operational details
              </div>
              <div className="section-content">
                <div className="form-row">
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
                  <div className="form-group">
                    <label>Current stock</label>
                    <input
                      type="number"
                      min="0"
                      value={totalQuantity}
                      onChange={(e) => setTotalQuantity(e.target.value)}
                      className="form-input"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reorder at</label>
                  <input
                    type="number"
                    min="0"
                    value={reorderAt}
                    onChange={(e) => setReorderAt(e.target.value)}
                    className="form-input"
                    placeholder="Leave blank for no threshold"
                  />
                </div>
              </div>
            </div>

            {/* Assign to locations */}
            <div className="detail-section">
              <div className="section-title">
                <span
                  className="section-badge"
                  style={{ background: "#f5efe6", color: "#998874" }}
                >
                  LC
                </span>
                Assign to locations
              </div>
              <div className="section-content">
                {!locationsExist ? (
                  <p>
                    No storage locations set up yet.{" "}
                    <Link to="/locations">Go to Locations</Link>
                  </p>
                ) : (
                  <>
                    {assignments.map((assignment, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        <select
                          value={assignment.locationId}
                          onChange={(e) =>
                            updateAssignment(
                              index,
                              "locationId",
                              e.target.value,
                            )
                          }
                          className="form-input"
                          style={{ flex: 2 }}
                        >
                          <option value="">Select a location...</option>
                          {storageLocations.map((loc) => (
                            <option key={loc._id} value={loc._id}>
                              {buildLocationLabel(
                                loc,
                                storageUnits,
                                floorMaps,
                                sites,
                              )}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          placeholder="Qty"
                          value={assignment.quantity}
                          onChange={(e) =>
                            updateAssignment(index, "quantity", e.target.value)
                          }
                          className="form-input"
                          style={{ maxWidth: "80px" }}
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => removeAssignment(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={addAssignment}
                    >
                      + Add Location
                    </button>
                    {remaining !== null && (
                      <p className="warning-text" style={{ marginTop: "12px" }}>
                        {remaining === 0 &&
                          `All ${parsedTotal} units assigned.`}
                        {remaining > 0 &&
                          `${assignedTotal} of ${parsedTotal} assigned — ${remaining} remaining.`}
                        {remaining < 0 &&
                          `Over-assigned by ${Math.abs(remaining)} unit${Math.abs(remaining) !== 1 ? "s" : ""}.`}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="right-column">
            {/* Visual catalogue */}
            <div className="detail-section">
              <div className="section-title">
                <span
                  className="section-badge"
                  style={{ background: "#d6ede8", color: "#4a8c78" }}
                >
                  IM
                </span>
                Visual catalogue
              </div>
              <div className="section-content">
                <div className="main-image-container">
                  {imageUrls.length > 0 ? (
                    <img
                      src={imageUrls[mainImageIndex]}
                      alt="Product preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: "13px", color: "#998874" }}>
                      {uploadingImage ? "Uploading..." : "No image uploaded"}
                    </span>
                  )}
                </div>

                <div className="thumbnail-gallery">
                  {imageUrls.map((url, index) => (
                    <div
                      key={url}
                      style={{ position: "relative", display: "inline-block" }}
                    >
                      <button
                        type="button"
                        className={`thumbnail ${index === mainImageIndex ? "active" : ""}`}
                        onClick={() => setMainImageIndex(index)}
                        title="Set as main image"
                      >
                        <img
                          src={url}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
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
                          border: "1px solid #999",
                          background: "#fff",
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
                  <p className="warning-text" style={{ marginTop: "8px" }}>
                    {uploadError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="create-product-footer">
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Create Product
          </button>
        </div>
      </div>
    </>
  );
}
