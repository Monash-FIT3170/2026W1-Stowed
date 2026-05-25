import { useEffect, useMemo, useState, useRef } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";

import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from "/imports/api/locations/collections";
import { ProductRecords } from "/imports/api/products/collections";
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
  const { role } = useAuth();
  const canManage = hasClientPermission(role, "locations.manage");

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedFloorMapId, setSelectedFloorMapId] = useState("");
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState("");
  const [floorMapForm, setFloorMapForm] = useState({ name: "", imageUrl: "" });
  const [unitForm, setUnitForm] = useState(DEFAULT_UNIT_FORM);
  const [locationForm, setLocationForm] = useState(DEFAULT_LOCATION_FORM);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const fileInputRef = useRef(null);

  // Edit state for each level
  const [editingFloorMapId, setEditingFloorMapId] = useState(null);
  const [editFloorMapForm, setEditFloorMapForm] = useState({ name: "", imageUrl: "" });
  const [editingStorageUnitId, setEditingStorageUnitId] = useState(null);
  const [editStorageUnitForm, setEditStorageUnitForm] = useState({ name: "", type: "shelf" });
  const [editingStorageLocationId, setEditingStorageLocationId] = useState(null);
  const [editStorageLocationForm, setEditStorageLocationForm] = useState({ name: "", code: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, id, name }
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState(""); // non-empty = show error modal

  const { isLoading, sites, floorMaps, storageUnits, storageLocations, productRecords } =
    useTracker(() => {
      const handle = Meteor.subscribe("locations.all");
      Meteor.subscribe("productRecords");
      return {
        isLoading: !handle.ready(),
        sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
        floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
        storageUnits: StorageUnits.find({}, { sort: { createdAt: 1 } }).fetch(),
        storageLocations: StorageLocations.find({}, { sort: { createdAt: 1 } }).fetch(),
        productRecords: ProductRecords.find().fetch(),
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

  function tryDeleteItem(type, id, name) {
    let blocked = "";
    if (type === "site") {
      if (floorMaps.some((f) => f.siteId === id)) blocked = "This site still has floor maps. Delete all floor maps in this site first.";
    } else if (type === "floorMap") {
      if (storageUnits.some((u) => u.floorMapId === id)) blocked = "This floor map still has storage units. Delete all storage units first.";
    } else if (type === "storageUnit") {
      if (storageLocations.some((l) => l.storageUnitId === id)) blocked = "This storage unit still has storage locations. Delete all storage locations first.";
    } else if (type === "storageLocation") {
      if (productRecords.some((r) => r.locationId === id)) blocked = "This location still has products assigned to it. Move or remove all products from this location first.";
    }
    if (blocked) {
      setDeleteBlockedMessage(blocked);
    } else {
      setDeleteConfirm({ type, id, name });
    }
  }

  function startEditFloorMap(fm) {
    setEditingFloorMapId(fm._id);
    setEditFloorMapForm({ name: fm.name, imageUrl: fm.imageUrl || "" });
  }

  async function saveEditFloorMap(floorMapId) {
    const name = editFloorMapForm.name.trim();
    if (!name) return;
    const duplicate = floorMapsForSite.some((f) => f._id !== floorMapId && f.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { setStatus({ type: "error", message: "A floor map with that name already exists in this site." }); return; }
    const fm = floorMaps.find((f) => f._id === floorMapId);
    await runSubmit(async () => {
      await submitMeteorMethod("floorMaps.update", { floorMapId, siteId: fm.siteId, name, imageUrl: editFloorMapForm.imageUrl.trim(), floorSize: fm.floorSize || {}, settings: fm.settings || {} });
      setEditingFloorMapId(null);
    });
  }

  function startEditStorageUnit(unit) {
    setEditingStorageUnitId(unit._id);
    setEditStorageUnitForm({ name: unit.name, type: unit.type });
  }

  async function saveEditStorageUnit(unitId) {
    const name = editStorageUnitForm.name.trim();
    if (!name) return;
    const duplicate = storageUnitsForFloorMap.some((u) => u._id !== unitId && u.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { setStatus({ type: "error", message: "A storage unit with that name already exists on this floor map." }); return; }
    const unit = storageUnits.find((u) => u._id === unitId);
    await runSubmit(async () => {
      await submitMeteorMethod("storageUnits.update", { storageUnitId: unitId, floorMapId: unit.floorMapId, name, type: editStorageUnitForm.type, position: unit.position });
      setEditingStorageUnitId(null);
    });
  }

  function startEditStorageLocation(loc) {
    setEditingStorageLocationId(loc._id);
    setEditStorageLocationForm({ name: loc.name, code: loc.code || "" });
  }

  async function saveEditStorageLocation(locationId) {
    const name = editStorageLocationForm.name.trim();
    const code = editStorageLocationForm.code.trim();
    if (!name || !code) return;
    const duplicate = locationsForStorageUnit.some((l) => l._id !== locationId && l.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { setStatus({ type: "error", message: "A location with that name already exists in this storage unit." }); return; }
    const loc = storageLocations.find((l) => l._id === locationId);
    await runSubmit(async () => {
      await submitMeteorMethod("storageLocations.update", { storageLocationId: locationId, storageUnitId: loc.storageUnitId, name, code, imageUrl: loc.imageUrl || "" });
      setEditingStorageLocationId(null);
    });
  }

  async function handleDeleteConfirmed() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    setDeleteConfirm(null);
    await runSubmit(async () => {
      if (type === "site") await submitMeteorMethod("sites.delete", { siteId: id });
      else if (type === "floorMap") await submitMeteorMethod("floorMaps.delete", { floorMapId: id });
      else if (type === "storageUnit") await submitMeteorMethod("storageUnits.delete", { storageUnitId: id });
      else if (type === "storageLocation") await submitMeteorMethod("storageLocations.delete", { storageLocationId: id });
    });
  }

  return (
    <div className="product-detail-container">
      <div className="product-detail-header">
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

      <div className="product-detail-grid">
        <div className="left-column">
          <Panel title="Floor Maps">
            {canManage && (
              <form className="form-grid" onSubmit={handleFloorMapSubmit}>
                <Field label="Name">
                  <TextInput
                    value={floorMapForm.name}
                    onChange={(e) => setFloorMapForm((cur) => ({ ...cur, name: e.target.value }))}
                    placeholder="Ground Floor"
                  />
                </Field>
                <button type="submit" disabled={submitting || !floorMapForm.name.trim()} className="btn-primary" style={{ width: "100%" }}>
                  Add Floor Map
                </button>
              </form>
            )}
            {floorMapsForSite.length ? (
              <div className="selection-list">
                {floorMapsForSite.map((floorMap) => (
                  <div key={floorMap._id} className={`selection-item ${floorMap._id === selectedFloorMapId ? "selection-item-selected" : "selection-item-unselected"}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {editingFloorMapId === floorMap._id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <input className="form-input" value={editFloorMapForm.name} onChange={(e) => setEditFloorMapForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => saveEditFloorMap(floorMap._id)} disabled={submitting || !editFloorMapForm.name.trim()}>Save</button>
                          <button type="button" className="btn-secondary" onClick={() => setEditingFloorMapId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button type="button" onClick={() => setSelectedFloorMapId(floorMap._id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                          <div className="selection-item-name">{floorMap.name}</div>
                        </button>
                        {canManage && <button type="button" className="btn-secondary" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={() => startEditFloorMap(floorMap)}>Edit</button>}
                        {canManage && <button type="button" className="btn-danger" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={() => tryDeleteItem("floorMap", floorMap._id, floorMap.name)}>Delete</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No floor maps yet. Create one to get started.</EmptyState>
            )}
          </Panel>

          <Panel title="Storage Units" subtitle={selectedFloorMap ? `Placed on ${selectedFloorMap.name}.` : "Select a floor map first."}>
            {canManage && <form className="form-grid form-grid-cols-2" onSubmit={handleCreateStorageUnit}>
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
            </form>}
            {storageUnitsForFloorMap.length ? (
              <div className="selection-list">
                {storageUnitsForFloorMap.map((unit) => (
                  <div key={unit._id} className={`selection-item ${unit._id === selectedStorageUnitId ? "selection-item-selected" : "selection-item-unselected"}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {editingStorageUnitId === unit._id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <input className="form-input" value={editStorageUnitForm.name} onChange={(e) => setEditStorageUnitForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
                        <select className="form-input" value={editStorageUnitForm.type} onChange={(e) => setEditStorageUnitForm((f) => ({ ...f, type: e.target.value }))}>
                          {STORAGE_UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => saveEditStorageUnit(unit._id)} disabled={submitting || !editStorageUnitForm.name.trim()}>Save</button>
                          <button type="button" className="btn-secondary" onClick={() => setEditingStorageUnitId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button type="button" onClick={() => setSelectedStorageUnitId(unit._id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                          <div className="unit-list-item-flex">
                            <span className="selection-item-name">{unit.name}</span>
                            <span className={`unit-type-badge ${unit._id === selectedStorageUnitId ? "unit-type-badge-selected" : ""}`}>{unit.type}</span>
                          </div>
                          <div className="unit-list-item-meta">{`x:${unit.position.x} y:${unit.position.y} w:${unit.position.width} h:${unit.position.height}`}</div>
                        </button>
                        {canManage && <button type="button" className="btn-secondary" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={() => startEditStorageUnit(unit)}>Edit</button>}
                        {canManage && <button type="button" className="btn-danger" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={() => tryDeleteItem("storageUnit", unit._id, unit.name)}>Delete</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No storage units on this floor map yet.</EmptyState>
            )}
          </Panel>

          <Panel badge="lc" title="Storage Locations" subtitle={selectedStorageUnit ? `Attached to ${selectedStorageUnit.name}.` : "Select a storage unit first."}>
            {canManage && <form className="form-grid form-grid-cols-2" onSubmit={handleCreateStorageLocation}>
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
            </form>}
            {locationsForStorageUnit.length ? (
              <div className="selection-list">
                {locationsForStorageUnit.map((location) => (
                  <div key={location._id} className="location-list-item">
                    {editingStorageLocationId === location._id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                        <input className="form-input" value={editStorageLocationForm.name} onChange={(e) => setEditStorageLocationForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
                        <input className="form-input" value={editStorageLocationForm.code} onChange={(e) => setEditStorageLocationForm((f) => ({ ...f, code: e.target.value }))} placeholder="Code" />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => saveEditStorageLocation(location._id)} disabled={submitting || !editStorageLocationForm.name.trim() || !editStorageLocationForm.code.trim()}>Save</button>
                          <button type="button" className="btn-secondary" onClick={() => setEditingStorageLocationId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="location-list-details">
                          <div className="location-list-item-name">{location.name}</div>
                          <div className="location-list-item-code">{location.code}</div>
                        </div>
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          {canManage && <button className="location-list-item-view-image" onClick={() => { setSelectedLocation(location); setImageModalOpen(true); }}>Image</button>}
                          {canManage && <button type="button" className="btn-secondary" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={() => startEditStorageLocation(location)}>Edit</button>}
                          {canManage && <button type="button" className="btn-danger" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={() => tryDeleteItem("storageLocation", location._id, location.name)}>Delete</button>}
                        </div>
                      </>
                    )}
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

        </div>
      </div>

      {deleteBlockedMessage && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Cannot Delete</h3>
            <p className="modal-text">{deleteBlockedMessage}</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setDeleteBlockedMessage("")}>OK</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Delete "{deleteConfirm.name}"?</h3>
            <p className="modal-text">This will permanently remove this item. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={submitting}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteConfirmed} disabled={submitting}>
                {submitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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