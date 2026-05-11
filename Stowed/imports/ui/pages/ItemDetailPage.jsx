import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products } from "../../api/products/collections";
import "./ItemDetailPage.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

const buttonStyle = {
  padding: "6px 14px",
  border: "1px solid #333",
  borderRadius: "3px",
  cursor: "pointer",
  background: "transparent",
  fontSize: "14px",
};

const dangerButtonStyle = {
  ...buttonStyle,
  border: "1px solid #c00",
  color: "#c00",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};

const modalStyle = {
  background: "#fff",
  border: "1px solid #ccc",
  borderRadius: "6px",
  padding: "28px",
  maxWidth: "400px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
};

export function ItemDetailView({ item, productId }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  if (!item) {
    return <div className="p-8 text-center">Item not found.</div>;
  }

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
  const statusLabel = isLowStock ? item.status : "In Stock";
  const statusClass = isLowStock
    ? "status-badge critical-badge"
    : "status-badge available-badge";

  return (
    <>
      <div className="item-detail-container">
        <div className="item-detail-header">
          <div className="header-top">
            <div className="breadcrumb">
              Inventory &nbsp;/&nbsp; {item.name}
            </div>
            <div className="header-actions">
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

          <div
            className={`header-content ${isLowStock ? "critical" : "available"}`}
          >
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
                <span>{item.currentStock} in stock</span>
                <span></span>
                <span>Reorder at {item.reorderAt}</span>
                <span></span>
                <span className="sku">SKU: {item.sku}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="item-detail-grid">
          <div className="left-column">
            <div className="detail-section">
              <h2 className="section-title"> Core identification</h2>
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
              <h2 className="section-title"> Operational details</h2>
              <div className="section-content">
                <div className="form-row">
                  <div className="form-group">
                    <label>Unit cost</label>
                    <input
                      type="text"
                      value={`$${item.unitCost.toFixed(2)}`}
                      readOnly
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Current stock</label>
                    <input
                      type="text"
                      value={item.currentStock}
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
                      value={item.reorderAt}
                      readOnly
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <div className="form-tag">{item.location}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="right-column">
            <div className="detail-section">
              <h2 className="section-title"> Visual catalogue</h2>
              <div className="section-content">
                <div className="main-image-container">
                  <img
                    src={item.catalogImages[selectedImageIndex]}
                    alt={item.name}
                    className="main-image"
                  />
                </div>
                <div className="thumbnail-gallery">
                  {item.catalogImages.map((img, index) => (
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
              <h2 className="section-title"> QR & label</h2>
              <div className="section-content qr-section">
                <div className="qr-container">
                  <img src={item.qrCode} alt="QR Code" className="qr-code" />
                  <p className="qr-label">SKU: {item.sku}</p>
                  <p className="qr-label">{item.location}</p>
                </div>
                <button className="btn-print">Print label</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3
              style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px" }}
            >
              Delete "{item.name}"?
            </h3>
            <p style={{ marginBottom: "24px", color: "#666" }}>
              This will permanently delete the product and remove it from all
              storage locations.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                style={buttonStyle}
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                style={dangerButtonStyle}
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

  const { item, isLoading } = useTracker(() => {
    const handle = Meteor.subscribe("products");
    return {
      isLoading: !handle.ready(),
      item: Products.findOne(productId),
    };
  }, [productId]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return <ItemDetailView item={item} productId={productId} />;
}
