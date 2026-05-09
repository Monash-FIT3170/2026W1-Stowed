import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getMockStorageLocationsByUnitId,
  getMockStorageUnitById,
} from "../../api/mockLocations";
import "./StorageUnitDetailPage.css";

const STORAGE_UNIT_PHOTOS_KEY = "stowed.storageUnitPhotos";

function readSavedPhotos() {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_UNIT_PHOTOS_KEY) || "{}");
  } catch {
    return {};
  }
}

function getSavedPhotoForUnit(unitId, fallbackPhotoUrl) {
  const savedPhotos = readSavedPhotos();
  return Object.prototype.hasOwnProperty.call(savedPhotos, unitId)
    ? savedPhotos[unitId]
    : fallbackPhotoUrl || "";
}

export function StorageUnitDetailPage() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const unit = getMockStorageUnitById(unitId);
  const locations = getMockStorageLocationsByUnitId(unitId);
  const [photoPreview, setPhotoPreview] = useState(() => getSavedPhotoForUnit(unitId, unit?.photoUrl));
  const [saveMessage, setSaveMessage] = useState("");
  const loading = false;

  if (loading) return <p className="storage-page-message">Loading...</p>;
  if (!unit) return <p className="storage-page-message">Storage unit not found.</p>;

  const unitCode = unit.name.toUpperCase();
  const locationCount = locations.length;
  const storedItemCount = locations.reduce(
    (total, location) => total + (location.storedItems?.length || 0),
    0,
  );
  const widthMeters = unit.position.width / 50;
  const heightMeters = unit.position.height / 50;

  function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
      setSaveMessage("Unsaved photo change");
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setPhotoPreview("");
    setSaveMessage("Unsaved photo removal");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSaveChanges() {
    const savedPhotos = readSavedPhotos();
    savedPhotos[unitId] = photoPreview;
    window.localStorage.setItem(STORAGE_UNIT_PHOTOS_KEY, JSON.stringify(savedPhotos));
    setSaveMessage("Changes saved");
  }

  return (
    <div className="storage-detail-page">
      <header className="storage-detail-header">
        <div className="storage-header-top">
          <div>
            <p className="storage-breadcrumb">Mornington Hardware / Floor map / {unitCode}</p>
            <p className="storage-live-dot">Live floor map</p>
          </div>
          <div className="storage-actions">
            <button className="storage-btn storage-btn-secondary" onClick={() => navigate("/floor-map")}>
              Back
            </button>
            <button className="storage-btn storage-btn-primary" onClick={handleSaveChanges}>
              Save changes
            </button>
          </div>
        </div>

        <section className="storage-hero">
          <div className="storage-unit-mark" aria-hidden="true">
            <span>{unitCode.slice(0, 2)}</span>
          </div>
          <div className="storage-hero-copy">
            <div className="storage-status-pill">Selected storage unit</div>
            <h1>{unit.name}</h1>
            <div className="storage-meta">
              <span>{unit.type} storage unit</span>
              <span>{locationCount} storage locations</span>
              <span>{storedItemCount} stored item types</span>
              <span>{widthMeters}m x {heightMeters}m footprint</span>
            </div>
          </div>
        </section>
      </header>

      <main className="storage-detail-grid">
        <section className="storage-panel storage-panel-wide storage-photo-panel">
          <div className="storage-section-title">
            <span className="storage-section-icon">PH</span>
            Storage unit photo
          </div>
          <div className="storage-section-body">
            {photoPreview ? (
              <div className="storage-photo-frame">
                <img src={photoPreview} alt={`${unit.name} storage unit`} />
              </div>
            ) : (
              <div className="storage-photo-empty">
                <div className="storage-empty-mark">{unitCode}</div>
                <p>No photo uploaded yet</p>
              </div>
            )}
            <div className="storage-photo-actions">
              <input
                ref={fileInputRef}
                className="storage-file-input"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
              />
              <button
                className="storage-upload-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload photo
              </button>
              {photoPreview && (
                <button className="storage-remove-btn" type="button" onClick={handleRemovePhoto}>
                  Remove
                </button>
              )}
            </div>
            {saveMessage && <p className="storage-save-message">{saveMessage}</p>}
          </div>
        </section>

        <section className="storage-panel">
          <div className="storage-section-title">
            <span className="storage-section-icon">ST</span>
            Stored summary
          </div>
          <div className="storage-section-body">
            <div className="storage-summary-list">
              <div>
                <span>Storage unit</span>
                <strong>{unitCode}</strong>
              </div>
              <div>
                <span>Storage locations inside</span>
                <strong>{locationCount}</strong>
              </div>
              <div>
                <span>Stored item types</span>
                <strong>{storedItemCount}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="storage-panel">
          <div className="storage-section-title">
            <span className="storage-section-icon">QR</span>
            QR & label
          </div>
          <div className="storage-section-body storage-label-body">
            <div className="storage-qr">
              <div className="storage-qr-grid" aria-hidden="true" />
              <p>SKU: {unitCode}</p>
              <p>Ground Floor</p>
            </div>
            <button className="storage-print-btn">Print label</button>
          </div>
        </section>

        <section className="storage-panel storage-panel-wide">
          <div className="storage-section-title">
            <span className="storage-section-icon">SL</span>
            What is stored in this unit
          </div>
          <div className="storage-location-list">
            {locations.length > 0 ? (
              locations.map((location) => (
                <div className="storage-location-row" key={location._id}>
                  <div className="storage-location-heading">
                    <strong>{location.name}</strong>
                    <span>{location.code}</span>
                  </div>
                  <div className="storage-stored-items">
                    {location.storedItems?.length ? (
                      location.storedItems.map((item) => (
                        <div className="storage-stored-item" key={item.itemId || item.sku}>
                          <span>
                            {item.name}
                            <small>
                              _id: {item.itemId || "n/a"}
                              {item.status ? ` · ${item.status}` : ""}
                            </small>
                          </span>
                          <strong>qty {item.quantity}</strong>
                        </div>
                      ))
                    ) : (
                      <span className="storage-no-items">Empty/available space</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="storage-location-empty">No storage locations inside this unit yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
