import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { Products } from "/imports/api/products/collections";
import { ProductCategories } from "/imports/api/categories/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "/imports/api/locations/collections";
import { ManageCategoriesModal } from "../components/ManageCategoriesModal";
import { useToast } from "../components/Toast";
import "./CreateProductPage.css";
import "../Global.css";
import { uploadImageToServer, isImageFile } from "/imports/api/upload";
import { useProductFormValidation } from "../hooks/useProductFormValidation";
import { FieldError, FormErrorSummary } from "../components/FieldError";

// Helpers

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

  return [site?.name, floorMap?.name, unit?.name, location.name].filter(Boolean).join(" → ");
}

// Component

export function CreateProductPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const prefill = location.state?.prefill;

  useEffect(() => {
    if (role !== null && !hasClientPermission(role, "products.create")) {
      navigate("/inventory", { replace: true });
    }
  }, [role, navigate]);

  const [name, setName] = useState(prefill?.name || "");
  const [description] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState(prefill?.brand || "");
  const [unitCost, setUnitCost] = useState(prefill?.unitCost ?? "");
  const [sku, setSku] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [reorderAt, setReorderAt] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [imageUrls, setImageUrls] = useState(prefill?.images || []);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const { products, categories, sites, floorMaps, storageUnits, storageLocations } =
    useTracker(() => {
      Meteor.subscribe("products");
      Meteor.subscribe("productCategories");
      Meteor.subscribe("locations.all");
      return {
        products: Products.find().fetch(),
        categories: ProductCategories.find().fetch(),
        sites: Sites.find().fetch(),
        floorMaps: FloorMaps.find().fetch(),
        storageUnits: StorageUnits.find().fetch(),
        storageLocations: StorageLocations.find().fetch(),
      };
    }, []);

  const parsedTotal = parseInt(totalQuantity, 10);

  const isDuplicate =
    name.trim().length > 0 &&
    products.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());

  const validAssignments = assignments.filter((a) => a.locationId && a.quantity !== "");

  const validation = useProductFormValidation({
    name,
    totalQuantity,
    reorderAt,
    unitCost,
    purchaseCost,
    assignments,
    isDuplicate,
  });
  const { fieldError, rowError, inputProps } = validation;
  const nameError = fieldError("name");
  const unitCostError = fieldError("unitCost");
  const purchaseCostError = fieldError("purchaseCost");
  const totalQuantityError = fieldError("totalQuantity");
  const reorderAtError = fieldError("reorderAt");
  const assignmentsError = fieldError("assignments");

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

    if (!isImageFile(file)) {
      toast.error("Please select an image file.");
      return;
    }

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
      toast.error("Image upload failed. Please try again.");
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validation.attemptSubmit()) {
      toast.error(
        `Please fix ${validation.count} issue${validation.count !== 1 ? "s" : ""} before creating the product.`,
      );
      return;
    }

    try {
      await callMethod("products.createWithAssignments", {
        name,
        description,
        categoryId,
        brand,
        sku: sku.trim(),
        unitCost: unitCost ? parseFloat(unitCost) : undefined,
        purchaseCost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        totalQuantity: parsedTotal,
        reorderAt: reorderAt ? parseInt(reorderAt, 10) : undefined,
        images: imageUrls,
        assignments: validAssignments.map((a) => ({
          locationId: a.locationId,
          quantity: parseInt(a.quantity, 10),
        })),
      });

      toast.success(`"${name}" created.`);
      navigate("/inventory");
    } catch (error) {
      console.error("Failed to create product:", error);
      toast.error(error.reason || error.message || "Failed to create product.");
    }
  }

  const locationsExist = storageLocations.length > 0;
  const canManageCategories = hasClientPermission(role, "productCategories.manage");

  return (
    <>
      <div className="product-detail-container">
        <div className="product-detail-header">
          <div className="header-top">
            <div className="breadcrumb">
              <Link to="/inventory" className="breadcrumb-link">
                Inventory
              </Link>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">Create product</span>
            </div>
          </div>
          <h1 className="header-title">
            Create <em>Product</em>
          </h1>
        </div>

        {prefill && (
          <p className="warning-text" style={{ marginBottom: "16px", padding: "0 28px" }}>
            Prefilled from your search result, review the details before saving.
          </p>
        )}

        <div className="product-detail-grid">
          <div className="left-column">
            <div className="detail-section">
              <div className="section-title">
                <span className="section-badge" style={{ background: "#d6ede8", color: "#4a8c78" }}>
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
                    {...inputProps("name", nameError)}
                    placeholder="e.g. AAA Battery Pack"
                  />
                  <FieldError id="name-error" message={nameError} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="form-input"
                        style={{ flex: 1 }}
                      >
                        <option value="">Select a category...</option>
                        {categories.map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {canManageCategories && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setShowCategoryModal(true)}
                          title="Manage categories"
                        >
                          +
                        </button>
                      )}
                    </div>
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
                  <div className="form-group">
                    <label>SKU / barcode value</label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="form-input"
                      placeholder="e.g. LAB-GOG-01 (used for the printed barcode)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="section-title">
                <span className="section-badge" style={{ background: "#fde8d8", color: "#b5532a" }}>
                  OP
                </span>
                Operational details
              </div>
              <div className="section-content">
                <div className="form-row">
                  <div className="form-group">
                    <label>Sell Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                      {...inputProps("unitCost", unitCostError)}
                      placeholder="$0.00"
                    />
                    <FieldError id="unitCost-error" message={unitCostError} />
                  </div>
                  <div className="form-group">
                    <label>Purchase Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(e.target.value)}
                      {...inputProps("purchaseCost", purchaseCostError)}
                      placeholder="$0.00"
                    />
                    <FieldError id="purchaseCost-error" message={purchaseCostError} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Current stock</label>
                    <input
                      type="number"
                      min="0"
                      value={totalQuantity}
                      onChange={(e) => setTotalQuantity(e.target.value)}
                      {...inputProps("totalQuantity", totalQuantityError)}
                      placeholder="0"
                    />
                    <FieldError id="totalQuantity-error" message={totalQuantityError} />
                  </div>
                  <div className="form-group">
                    <label>Reorder at</label>
                    <input
                      type="number"
                      min="0"
                      value={reorderAt}
                      onChange={(e) => setReorderAt(e.target.value)}
                      {...inputProps("reorderAt", reorderAtError)}
                      placeholder="Leave blank for no threshold"
                    />
                    <FieldError id="reorderAt-error" message={reorderAtError} />
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="section-title">
                <span className="section-badge" style={{ background: "#f5efe6", color: "#998874" }}>
                  LC
                </span>
                Assign to locations
              </div>
              <div className="section-content">
                {!locationsExist ? (
                  <>
                    <p>
                      No storage locations set up yet. <Link to="/locations">Go to Locations</Link>
                    </p>
                    <FieldError id="assignments-error" message={assignmentsError} />
                  </>
                ) : (
                  <>
                    {assignments.map((assignment, index) => {
                      const assignmentError = rowError(index);
                      const rowKey = `row-${index}`;
                      const locationInvalid = assignmentError.startsWith("Choose a location");
                      return (
                        <div key={index} style={{ marginBottom: "8px" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <select
                              value={assignment.locationId}
                              onChange={(e) =>
                                updateAssignment(index, "locationId", e.target.value)
                              }
                              {...inputProps(rowKey, locationInvalid)}
                              style={{ flex: 2 }}
                            >
                              <option value="">Select a location...</option>
                              {storageLocations.map((loc) => (
                                <option key={loc._id} value={loc._id}>
                                  {buildLocationLabel(loc, storageUnits, floorMaps, sites)}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              placeholder="Qty"
                              aria-label="Quantity"
                              value={assignment.quantity}
                              onChange={(e) => updateAssignment(index, "quantity", e.target.value)}
                              {...inputProps(rowKey, assignmentError && !locationInvalid)}
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
                          <FieldError id={`${rowKey}-error`} message={assignmentError} />
                        </div>
                      );
                    })}
                    <button type="button" className="btn-secondary" onClick={addAssignment}>
                      + Add Location
                    </button>
                    <FieldError id="assignments-error" message={assignmentsError} />
                    {!assignmentsError && !validation.errors.totalQuantity && parsedTotal > 0 && (
                      <p className="field-hint" style={{ marginTop: "12px" }}>
                        All {parsedTotal} units assigned.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="right-column">
            <div className="detail-section">
              <div className="section-title">
                <span className="section-badge" style={{ background: "#d6ede8", color: "#4a8c78" }}>
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
                    <div key={url} style={{ position: "relative", display: "inline-block" }}>
                      <button
                        type="button"
                        className={`thumbnail ${index === mainImageIndex ? "active" : ""}`}
                        onClick={() => setMainImageIndex(index)}
                        title="Set as main image"
                      >
                        <img
                          src={url}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
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
              </div>
            </div>
          </div>
        </div>

        <div className="create-product-footer">
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <FormErrorSummary
            show={validation.submitAttempted && !validation.isValid}
            count={validation.count}
          />
          <button className="btn-primary" onClick={handleSubmit}>
            Create Product
          </button>
        </div>
      </div>

      {showCategoryModal && (
        <ManageCategoriesModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onCategoryDeleted={(deletedId) => {
            if (categoryId === deletedId) setCategoryId("");
          }}
        />
      )}
    </>
  );
}
