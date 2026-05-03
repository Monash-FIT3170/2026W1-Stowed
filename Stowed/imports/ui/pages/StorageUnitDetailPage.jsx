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
              <span>{unit.type}</span>
              <span>{locationCount} locations</span>
              <span>{widthMeters}m x {heightMeters}m footprint</span>
            </div>
          </div>
        </section>
      </header>

      <main className="storage-detail-grid">
        <section className="storage-panel storage-panel-large">
          <div className="storage-section-title">
            <span className="storage-section-icon">ID</span>
            Core identification
          </div>
          <div className="storage-section-body">
            <label className="storage-field">
              <span>Unit name</span>
              <input value={unit.name} readOnly />
            </label>
            <div className="storage-two-col">
              <label className="storage-field">
                <span>Type</span>
                <div className="storage-tag">{unit.type}</div>
              </label>
              <label className="storage-field">
                <span>Floor map</span>
                <div className="storage-tag">Ground Floor</div>
              </label>
            </div>
          </div>
        </section>

        <section className="storage-panel">
          <div className="storage-section-title">
            <span className="storage-section-icon">IM</span>
            Unit photo
          </div>
          <div className="storage-section-body">
            {photoPreview ? (
              <div className="storage-photo-frame">
                <img src={photoPreview} alt={unit.name} />
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

        <section className="storage-panel storage-panel-large">
          <div className="storage-section-title">
            <span className="storage-section-icon">OP</span>
            Operational details
          </div>
          <div className="storage-section-body">
            <div className="storage-two-col">
              <label className="storage-field">
                <span>X position</span>
                <input value={`${unit.position.x}px`} readOnly />
              </label>
              <label className="storage-field">
                <span>Y position</span>
                <input value={`${unit.position.y}px`} readOnly />
              </label>
            </div>
            <div className="storage-two-col">
              <label className="storage-field">
                <span>Width</span>
                <input value={`${unit.position.width}px`} readOnly />
              </label>
              <label className="storage-field">
                <span>Height</span>
                <input value={`${unit.position.height}px`} readOnly />
              </label>
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
            Storage locations
          </div>
          <div className="storage-location-list">
            {locations.length > 0 ? (
              locations.map((location) => (
                <div className="storage-location-row" key={location._id}>
                  <div>
                    <strong>{location.name}</strong>
                    <span>{location.code}</span>
                  </div>
                  <span className="storage-location-pill">Ready</span>
                </div>
              ))
            ) : (
              <div className="storage-location-empty">No shelf or drawer locations yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
