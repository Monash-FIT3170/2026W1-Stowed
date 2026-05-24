import { useEffect, useMemo, useState, useRef } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from "/imports/api/locations/collections";
import "../Global.css";
import "./LocationsPage.css";

const STORAGE_UNIT_TYPES = [
  "shelf",
  "cabinet",
  "rack",
  "drawer",
  "fridge",
  "other",
];

// Default form uses meter values to match the floor map editor coordinate system
const DEFAULT_UNIT_FORM = {
  name: "",
  type: "shelf",
  x: "2",
  y: "2",
  width: "2",
  height: "1",
};

const DEFAULT_LOCATION_FORM = {
  name: "",
  code: "",
};

function hasValidUnitPosition(unitForm) {
  return ["x", "y", "width", "height"].every((key) => {
    const value = Number(unitForm[key]);
    return Number.isFinite(value) && value >= 0;
  });
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="detail-section">
      <div className="section-title">
        {title}
        {subtitle && (
          <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: "12px", color: "var(--text-muted)" }}>
            {subtitle}
          </span>
        )}
      </div>
      <div className="section-content">{children}</div>
    </section>
  );
}

function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

function Field({ label, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        className="form-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextArea(props) {
  return <textarea {...props} className="form-input" />;
}

function SelectInput({ label, options, ...props }) {
  return (
    <Field label={label}>
      <select {...props} className="form-input">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function NumberInput({ label, ...props }) {
  return (
    <Field label={label}>
      <input {...props} type="number" min={0} className="form-input" />
    </Field>
  );
}

function submitMeteorMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

export function LocationsPage() {
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedFloorMapId, setSelectedFloorMapId] = useState("");
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState("");
  const [siteForm, setSiteForm] = useState({ name: "", description: "" });
  const [floorMapForm, setFloorMapForm] = useState({ name: "", imageUrl: "" });
  const [unitForm, setUnitForm] = useState(DEFAULT_UNIT_FORM);
  const [locationForm, setLocationForm] = useState(DEFAULT_LOCATION_FORM);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const fileInputRef = useRef(null);

  const { isLoading, sites, floorMaps, storageUnits, storageLocations } =
    useTracker(() => {
      const handle = Meteor.subscribe("locations.all");
      return {
        isLoading: !handle.ready(),
        sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
        floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
        storageUnits: StorageUnits.find({}, { sort: { createdAt: 1 } }).fetch(),
        storageLocations: StorageLocations.find({}, { sort: { createdAt: 1 } }).fetch(),
      };
    }, []);

  const selectedSite = useMemo(
    () => sites.find((site) => site._id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const floorMapsForSite = useMemo(
    () => floorMaps.filter((floorMap) => floorMap.siteId === selectedSiteId),
    [floorMaps, selectedSiteId],
  );

  const selectedFloorMap = useMemo(
    () => floorMaps.find((floorMap) => floorMap._id === selectedFloorMapId) ?? null,
    [floorMaps, selectedFloorMapId],
  );

  const storageUnitsForFloorMap = useMemo(
    () => storageUnits.filter((unit) => unit.floorMapId === selectedFloorMapId),
    [storageUnits, selectedFloorMapId],
  );

  const selectedStorageUnit = useMemo(
    () => storageUnits.find((unit) => unit._id === selectedStorageUnitId) ?? null,
    [storageUnits, selectedStorageUnitId],
  );

  const locationsForStorageUnit = useMemo(
    () => storageLocations.filter((location) => location.storageUnitId === selectedStorageUnitId),
    [storageLocations, selectedStorageUnitId],
  );

  const currentLocation =
    storageLocations.find((loc) => loc._id === selectedLocation?._id) ?? selectedLocation;

  useEffect(() => {
    if (!sites.length) { setSelectedSiteId(""); return; }
    if (!sites.some((site) => site._id === selectedSiteId)) {
      setSelectedSiteId(sites[0]._id);
    }
  }, [selectedSiteId, sites]);

  useEffect(() => {
    if (!floorMapsForSite.length) { setSelectedFloorMapId(""); return; }
    if (!floorMapsForSite.some((floorMap) => floorMap._id === selectedFloorMapId)) {
      setSelectedFloorMapId(floorMapsForSite[0]._id);
    }
  }, [floorMapsForSite, selectedFloorMapId]);

  useEffect(() => {
    if (!storageUnitsForFloorMap.length) { setSelectedStorageUnitId(""); return; }
    if (!storageUnitsForFloorMap.some((unit) => unit._id === selectedStorageUnitId)) {
      setSelectedStorageUnitId(storageUnitsForFloorMap[0]._id);
    }
  }, [storageUnitsForFloorMap, selectedStorageUnitId]);

  async function runSubmit(action) {
    setSubmitting(true);
    setStatus({ type: "", message: "" });
    try {
      await action();
      setStatus({ type: "success", message: "Saved." });
    } catch (error) {
      setStatus({ type: "error", message: error.reason || error.message || "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSiteSubmit(event) {
    event.preventDefault();
    await runSubmit(async () => {
      await submitMeteorMethod("sites.create", {
        name: siteForm.name.trim(),
        description: siteForm.description.trim(),
      });
      setSiteForm({ name: "", description: "" });
    });
  }

  async function handleFloorMapSubmit(event) {
    event.preventDefault();
    if (!selectedSiteId) { setStatus({ type: "error", message: "Create a site first." }); return; }
    await runSubmit(async () => {
      await submitMeteorMethod("floorMaps.create", {
        siteId: selectedSiteId,
        name: floorMapForm.name.trim(),
        imageUrl: floorMapForm.imageUrl.trim(),
      });
      setFloorMapForm({ name: "", imageUrl: "" });
    });
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setStatus({ type: "error", message: "Invalid file type. Must be PNG or JPEG." });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const extension = file.name.split(".").pop();
      try {
        const url = await Meteor.callAsync("uploads.image", base64, extension);
        await Meteor.callAsync("storageLocations.update", {
          storageLocationId: selectedLocation._id,
          storageUnitId: selectedLocation.storageUnitId,
          name: selectedLocation.name ?? "",
          code: selectedLocation.code ?? "",
          imageUrl: url,
        });
        setStatus({ type: "success", message: "Image uploaded successfully." });
        setTimeout(() => setStatus({ type: "", message: "" }), 2000);
      } catch {
        setStatus({ type: "error", message: "Image failed to upload." });
        setTimeout(() => setStatus({ type: "", message: "" }), 2000);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateStorageUnit(event) {
    event.preventDefault();
    if (!selectedFloorMapId) { setStatus({ type: "error", message: "Create a floor map first." }); return; }
    await runSubmit(async () => {
      if (!hasValidUnitPosition(unitForm) || Number(unitForm.width) < 1 || Number(unitForm.height) < 1) {
        throw new Error("Position values must be numbers, and width/height must be at least 1.");
      }
      await submitMeteorMethod("storageUnits.create", {
        floorMapId: selectedFloorMapId,
        name: unitForm.name.trim(),
        type: unitForm.type,
        position: {
          x: Number(unitForm.x),
          y: Number(unitForm.y),
          width: Number(unitForm.width),
          height: Number(unitForm.height),
        },
      });
      setUnitForm(DEFAULT_UNIT_FORM);
    });
  }

  async function handleCreateStorageLocation(event) {
    event.preventDefault();
    if (!selectedStorageUnitId) { setStatus({ type: "error", message: "Create a storage unit first." }); return; }
    await runSubmit(async () => {
      await submitMeteorMethod("storageLocations.create", {
        storageUnitId: selectedStorageUnitId,
        name: locationForm.name.trim(),
        code: locationForm.code.trim(),
      });
      setLocationForm(DEFAULT_LOCATION_FORM);
    });
  }

  function closeModal() {
    setImageModalOpen(false);
    setSelectedLocation(null);
  }

  // Scale all units to fit within the preview container
  function getPreviewLayout(units) {
    if (!units.length) return { units: [], scale: 1 };

    const PX = 50;
    const PREVIEW_W = 280;
    const PREVIEW_H = 300;

    // Convert all to pixels first
    const converted = units.map((unit) => {
      const x = unit.position.x;
      const y = unit.position.y;
      const w = unit.position.width;
      const h = unit.position.height;
      const isMeters = x <= 20 && y <= 20 && w <= 20 && h <= 20;
      return {
        ...unit,
        px: { left: isMeters ? x * PX : x, top: isMeters ? y * PX : y, width: isMeters ? w * PX : w, height: isMeters ? h * PX : h },
      };
    });

    // Find bounding box
    const maxRight  = Math.max(...converted.map((u) => u.px.left + u.px.width));
    const maxBottom = Math.max(...converted.map((u) => u.px.top  + u.px.height));

    // Scale to fit with padding
    const scale = Math.min((PREVIEW_W - 8) / maxRight, (PREVIEW_H - 8) / maxBottom, 1);

    return { units: converted, scale };
  }

  return (
    <div className="item-detail-container">
      <div className="item-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Locations</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Add locations</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Locations <em>Overview</em></h1>
          <div className="locations-page-status-indicator">
            {isLoading ? "Loading location data…" : `${sites.length} sites loaded`}
          </div>
        </div>
      </div>

      {status.message && (
        <div
          className={`status-message ${status.type === "error" ? "status-message-error" : "status-message-success"}`}
          style={{ margin: "0 28px 16px" }}
        >
          {status.message}
        </div>
      )}

      <div className="item-detail-grid">
        <div className="left-column">
          <Panel title="Site" subtitle="Create and select the top-level physical area.">
            <form className="form-grid" onSubmit={handleSiteSubmit}>
              <Field label="Name">
                <TextInput
                  value={siteForm.name}
                  onChange={(e) => setSiteForm((cur) => ({ ...cur, name: e.target.value }))}
                  placeholder="Warehouse"
                />
              </Field>
              <Field label="Description">
                <TextArea
                  value={siteForm.description}
                  onChange={(e) => setSiteForm((cur) => ({ ...cur, description: e.target.value }))}
                  placeholder="Optional note"
                />
              </Field>
              <button type="submit" disabled={submitting || !siteForm.name.trim()} className="btn-primary" style={{ width: "100%" }}>
                Add Site
              </button>
            </form>
            {sites.length ? (
              <div className="selection-list">
                {sites.map((site) => (
                  <button
                    key={site._id}
                    type="button"
                    onClick={() => setSelectedSiteId(site._id)}
                    className={`selection-item ${site._id === selectedSiteId ? "selection-item-selected" : "selection-item-unselected"}`}
                  >
                    <div className="selection-item-name">{site.name}</div>
                    <div className="selection-item-description">{site.description || "No description"}</div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState>No sites yet. Create one to unlock the rest of the chain.</EmptyState>
            )}
          </Panel>

          <Panel title="Floor Maps" subtitle={selectedSite ? `Attached to ${selectedSite.name}.` : "Select a site first."}>
            <form className="form-grid form-grid-cols-2" onSubmit={handleFloorMapSubmit}>
              <Field label="Name">
                <TextInput
                  value={floorMapForm.name}
                  onChange={(e) => setFloorMapForm((cur) => ({ ...cur, name: e.target.value }))}
                  placeholder="Ground Floor"
                />
              </Field>
              <Field label="Image URL">
                <TextInput
                  value={floorMapForm.imageUrl}
                  onChange={(e) => setFloorMapForm((cur) => ({ ...cur, imageUrl: e.target.value }))}
                  placeholder="https://example.com/floor-map.png"
                />
              </Field>
              <button type="submit" disabled={submitting || !selectedSiteId || !floorMapForm.name.trim()} className="btn-primary" style={{ width: "100%" }}>
                Add Floor Map
              </button>
            </form>
            {floorMapsForSite.length ? (
              <div className="selection-list">
                {floorMapsForSite.map((floorMap) => (
                  <button
                    key={floorMap._id}
                    type="button"
                    onClick={() => setSelectedFloorMapId(floorMap._id)}
                    className={`selection-item ${floorMap._id === selectedFloorMapId ? "selection-item-selected" : "selection-item-unselected"}`}
                  >
                    <div className="selection-item-name">{floorMap.name}</div>
                    <div className="selection-item-description">{floorMap.imageUrl || "No image URL"}</div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState>No floor maps for this site yet.</EmptyState>
            )}
          </Panel>

          <Panel title="Storage Units" subtitle={selectedFloorMap ? `Placed on ${selectedFloorMap.name}.` : "Select a floor map first."}>
            <form className="form-grid form-grid-cols-2" onSubmit={handleCreateStorageUnit}>
              <TextInput label="Name" value={unitForm.name} onChange={(e) => setUnitForm((cur) => ({ ...cur, name: e.target.value }))} placeholder="Shelf A" />
              <SelectInput
                label="Type"
                value={unitForm.type}
                onChange={(e) => setUnitForm((cur) => ({ ...cur, type: e.target.value }))}
                options={STORAGE_UNIT_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <NumberInput label="X (meters)" value={unitForm.x} onChange={(e) => setUnitForm((cur) => ({ ...cur, x: e.target.value }))} />
              <NumberInput label="Y (meters)" value={unitForm.y} onChange={(e) => setUnitForm((cur) => ({ ...cur, y: e.target.value }))} />
              <NumberInput label="Width (meters)" value={unitForm.width} onChange={(e) => setUnitForm((cur) => ({ ...cur, width: e.target.value }))} />
              <NumberInput label="Height (meters)" value={unitForm.height} onChange={(e) => setUnitForm((cur) => ({ ...cur, height: e.target.value }))} />
              <button
                type="submit"
                disabled={submitting || !selectedFloorMapId || !unitForm.name.trim() || !hasValidUnitPosition(unitForm) || Number(unitForm.width) < 1 || Number(unitForm.height) < 1}
                className="btn-primary"
                style={{ width: "100%" }}
              >
                Add Storage Unit
              </button>
            </form>
            {storageUnitsForFloorMap.length ? (
              <div className="selection-list">
                {storageUnitsForFloorMap.map((unit) => (
                  <button
                    key={unit._id}
                    type="button"
                    onClick={() => setSelectedStorageUnitId(unit._id)}
                    className={`selection-item ${unit._id === selectedStorageUnitId ? "selection-item-selected" : "selection-item-unselected"}`}
                  >
                    <div className="unit-list-item-flex">
                      <span className="selection-item-name">{unit.name}</span>
                      <span className={`unit-type-badge ${unit._id === selectedStorageUnitId ? "unit-type-badge-selected" : ""}`}>{unit.type}</span>
                    </div>
                    <div className="unit-list-item-meta">
                      {`x:${unit.position.x} y:${unit.position.y} w:${unit.position.width} h:${unit.position.height}`}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState>No storage units on this floor map yet.</EmptyState>
            )}
          </Panel>

          <Panel badge="lc" title="Storage Locations" subtitle={selectedStorageUnit ? `Attached to ${selectedStorageUnit.name}.` : "Select a storage unit first."}>
            <form className="form-grid form-grid-cols-2" onSubmit={handleCreateStorageLocation}>
              <TextInput label="Name" value={locationForm.name} onChange={(e) => setLocationForm((cur) => ({ ...cur, name: e.target.value }))} placeholder="Top Shelf" />
              <TextInput label="Code" value={locationForm.code} onChange={(e) => setLocationForm((cur) => ({ ...cur, code: e.target.value }))} placeholder="SH-A-01" />
              <button
                type="submit"
                disabled={submitting || !selectedStorageUnitId || !locationForm.name.trim() || !locationForm.code.trim()}
                className="btn-primary"
                style={{ width: "100%" }}
              >
                Add Storage Location
              </button>
            </form>
            {locationsForStorageUnit.length ? (
              <div className="selection-list">
                {locationsForStorageUnit.map((location) => (
                  <div key={location._id} className="location-list-item">
                    <div className="location-list-details">
                      <div className="location-list-item-name">{location.name}</div>
                      <div className="location-list-item-code">{location.code}</div>
                    </div>
                    <button
                      className="location-list-item-view-image"
                      onClick={() => { setSelectedLocation(location); setImageModalOpen(true); }}
                    >
                      See Image
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No storage locations on this unit yet.</EmptyState>
            )}
          </Panel>
        </div>

        <div className="right-column">
          <Panel badge="qr" title="Relationship Summary" subtitle="Quick sanity check of what is currently selected.">
            <dl className="relationship-summary-list">
              <div className="relationship-summary-item">
                <dt className="relationship-summary-label">Site</dt>
                <dd className="relationship-summary-value">{selectedSite?.name || "None selected"}</dd>
              </div>
              <div className="relationship-summary-item">
                <dt className="relationship-summary-label">Floor Map</dt>
                <dd className="relationship-summary-value">{selectedFloorMap?.name || "None selected"}</dd>
              </div>
              <div className="relationship-summary-item">
                <dt className="relationship-summary-label">Storage Unit</dt>
                <dd className="relationship-summary-value">{selectedStorageUnit?.name || "None selected"}</dd>
              </div>
              <div className="relationship-summary-item">
                <dt className="relationship-summary-label">Storage Locations</dt>
                <dd className="relationship-summary-value">{locationsForStorageUnit.length}</dd>
              </div>
            </dl>
          </Panel>

          <Panel badge="lc" title="Floor Map Preview" subtitle="Simple visual check for storage-unit position values.">
            <div className="floor-map-preview-container">
              <div className="floor-map-preview-canvas" style={{ position: "relative", width: "100%", height: "300px", overflow: "hidden" }}>
                {(() => {
                  const { units: laid, scale } = getPreviewLayout(storageUnitsForFloorMap);
                  return laid.length ? laid.map((unit) => (
                    <button
                      key={unit._id}
                      type="button"
                      onClick={() => setSelectedStorageUnitId(unit._id)}
                      className={`floor-map-unit-button ${unit._id === selectedStorageUnitId ? "floor-map-unit-selected" : "floor-map-unit-unselected"}`}
                      style={{
                        left:   `${unit.px.left   * scale}px`,
                        top:    `${unit.px.top    * scale}px`,
                        width:  `${unit.px.width  * scale}px`,
                        height: `${unit.px.height * scale}px`,
                      }}
                    >
                      <div className="floor-map-unit-name" style={{ fontSize: `${Math.max(8, 11 * scale)}px` }}>{unit.name}</div>
                      <div className="floor-map-unit-type" style={{ fontSize: `${Math.max(7, 10 * scale)}px` }}>{unit.type}</div>
                    </button>
                  )) : (
                    <div className="floor-map-empty-state">Add a storage unit to see it plotted here.</div>
                  );
                })()}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {imageModalOpen && currentLocation && (
        <div className="modal-overlay location-image-modal" onClick={closeModal}>
          <div className="modal location-image-container" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{currentLocation.name} ({currentLocation.code})</h2>
            <div className="location-image-display">
              <img src={currentLocation.imageUrl} alt={currentLocation.name} className="location-image" />
            </div>
            <div className="location-image-footer">
              {status.message && (
                <div className={`status-message ${status.type === "error" ? "status-message-error" : "status-message-success"}`}>
                  {status.message}
                </div>
              )}
              <div className="location-image-footer-buttons">
                <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleUpload} />
                <button className="btn-primary" onClick={() => fileInputRef.current.click()}>Upload New</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}