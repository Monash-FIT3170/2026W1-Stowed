import { useParams, useNavigate } from "react-router-dom";
import { getMockItemById } from "../../api/mockItems";
import { useState } from "react";
import "./ItemDetailPage.css";

export function ItemDetailView({ item }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const navigate = useNavigate();

  if (!item) {
    return <div className="p-8 text-center">Item not found.</div>;
  }

  const isLowStock = item.status && item.status.includes("CRITICAL");
  const statusLabel = isLowStock ? item.status : "In Stock";
  const statusClass = isLowStock
    ? "status-badge critical-badge"
    : "status-badge available-badge";

  return (
    <div className="item-detail-container">
      <div className="item-detail-header">
        <div className="header-top">
          <div className="breadcrumb">Inventory &nbsp;/&nbsp; {item.name}</div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate(-1)}>
              Back
            </button>
            <button className="btn-primary">Save changes</button>
          </div>
        </div>

        <div
          className={`header-content ${isLowStock ? "critical" : "available"}`}
        >
          <div className="header-icon-section">
            <img src={item.photoUrl} alt={item.name} className="header-icon" />
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
  );
}

export function ItemDetailPage() {
  const { itemId } = useParams();
  const item = getMockItemById(itemId);

  return <ItemDetailView item={item} />;
}
