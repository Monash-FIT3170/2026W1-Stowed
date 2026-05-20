import { useEffect, useMemo, useState, useRef } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from "/imports/api/locations/collections";
import "./LocationsPage.css";

const STORAGE_UNIT_TYPES = [
  "shelf",
  "cabinet",
  "rack",
  "drawer",
  "fridge",
  "other",
];

const DEFAULT_UNIT_FORM = {
  name: "",
  type: "shelf",
  x: "24",
  y: "24",
  width: "120",
  height: "72",
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

function Panel({ title, subtitle, children, actions }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

function Field({ label, children }) {
  return (
    <label className="form-input-wrapper">
      <span className="form-input-label">{label}</span>
      {children}
    </label>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="form-input-wrapper">
      <span className="form-input-label">{label}</span>
      <input
        className="form-input-field"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea(props) {
  return <textarea {...props} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 min-h-[96px]" />;
}

function SelectInput({ label, options, ...props }) {
  return (
    <Field label={label}>
      <select
        {...props}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900 bg-white"
      >
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
      <input
        {...props}
        type="number"
        min={0}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
      />
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
        storageLocations: StorageLocations.find(
          {},
          { sort: { createdAt: 1 } },
        ).fetch(),
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
    () =>
      floorMaps.find((floorMap) => floorMap._id === selectedFloorMapId) ?? null,
    [floorMaps, selectedFloorMapId],
  );

  const storageUnitsForFloorMap = useMemo(
    () => storageUnits.filter((unit) => unit.floorMapId === selectedFloorMapId),
    [storageUnits, selectedFloorMapId],
  );

  const selectedStorageUnit = useMemo(
    () =>
      storageUnits.find((unit) => unit._id === selectedStorageUnitId) ?? null,
    [storageUnits, selectedStorageUnitId],
  );

  const locationsForStorageUnit = useMemo(
    () =>
      storageLocations.filter(
        (location) => location.storageUnitId === selectedStorageUnitId,
      ),
    [storageLocations, selectedStorageUnitId],
  );

  
    // reactive reference to storage location chosen
  const currentLocation = storageLocations.find((loc) => loc._id
                            === selectedLocation?._id) ?? selectedLocation;

  useEffect(() => {
    if (!sites.length) {
      setSelectedSiteId("");
      return;
    }

    if (!sites.some((site) => site._id === selectedSiteId)) {
      setSelectedSiteId(sites[0]._id);
    }
  }, [selectedSiteId, sites]);

  useEffect(() => {
    if (!floorMapsForSite.length) {
      setSelectedFloorMapId("");
      return;
    }

    if (
      !floorMapsForSite.some((floorMap) => floorMap._id === selectedFloorMapId)
    ) {
      setSelectedFloorMapId(floorMapsForSite[0]._id);
    }
  }, [floorMapsForSite, selectedFloorMapId]);

  useEffect(() => {
    if (!storageUnitsForFloorMap.length) {
      setSelectedStorageUnitId("");
      return;
    }

    if (
      !storageUnitsForFloorMap.some(
        (unit) => unit._id === selectedStorageUnitId,
      )
    ) {
      setSelectedStorageUnitId(storageUnitsForFloorMap[0]._id);
    }
  }, [storageUnitsForFloorMap, selectedStorageUnitId]);

  async function runAction(action, successMessage) {
    setSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      await action();
      setStatus({ type: "success", message: "Saved." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.reason || error.message || "Something went wrong.",
      });
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

    if (!selectedSiteId) {
      setStatus({ type: "error", message: "Create a site first." });
      return;
    }

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

    const allowedTypes = ['image/jpeg', 'image/png'];

    if(!allowedTypes.includes(file.type)) {
      setStatus({type: 'error', message: 'Invaid file type. Must be PNG or JPEG.'})
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const extension = file.name.split('.').pop();

      try {
        const url = await Meteor.callAsync('uploads.image', base64, extension);
        const payload = {
          storageLocationId: selectedLocation._id,
          storageUnitId: selectedLocation.storageUnitId,
          name: selectedLocation.name ?? '',
          code: selectedLocation.code ?? '',
          imageUrl: url,
        };
        await Meteor.callAsync('storageLocations.update', payload);
        setStatus({ type: 'success', message: 'Image uploaded successfully.'})
        setTimeout(() => setStatus({ type: '', message: '' }), 2000);
      } catch (err) {
        setStatus({ type: 'error', message: 'Image failed to upload.'})
        setTimeout(() => setStatus({ type: '', message: '' }), 2000);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateStorageUnit(event) {
    event.preventDefault();
    if (!selectedFloorMapId) {
      setStatus({ type: "error", message: "Create a floor map first." });
      return;
    }

    await runSubmit(async () => {
      if (
        !hasValidUnitPosition(unitForm) ||
        Number(unitForm.width) < 1 ||
        Number(unitForm.height) < 1
      ) {
        throw new Error(
          "Position values must be numbers, and width/height must be at least 1.",
        );
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
    if (!selectedStorageUnitId) {
      setStatus({ type: "error", message: "Create a storage unit first." });
      return;
    }

    await runSubmit(async () => {
      await submitMeteorMethod("storageLocations.create", {
        storageUnitId: selectedStorageUnitId,
        name: locationForm.name.trim(),
        code: locationForm.code.trim(),
      });
      setLocationForm(DEFAULT_LOCATION_FORM);
    });
  }
  function Field({ label, children }) {
    return (
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-700">
          {label}
        </span>
        {children}
      </label>
    );
  }

  return (
    <div className="locations-page-container">
      <div className="locations-page-wrapper">
        <div className="locations-page-header">
          <div>
            <h1 className="locations-page-title">Locations</h1>
            <p className="locations-page-subtitle">
              Minimal management UI for testing the Site → Floor Map → Storage
              Unit → Storage Location object chain.
            </p>
          </div>
          <div className="locations-page-status-indicator">
            {isLoading
              ? "Loading location data…"
              : `${sites.length} sites loaded`}
          </div>
        </div>

        {status.message ? (
          <div
            className={`status-message ${
              status.type === "error"
                ? "status-message-error"
                : "status-message-success"
            }`}
          >
            {status.message}
          </div>
        ) : null}

        <div className="locations-page-content">
          <div className="locations-page-left-column">
            <Panel
              title="Site"
              subtitle="Create and select the top-level physical area."
            >
              <form className="form-grid" onSubmit={handleSiteSubmit}>
                <Field label="Name">
                  <TextInput
                    value={siteForm.name}
                    onChange={(event) =>
                      setSiteForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Warehouse"
                  />
                </Field>
                <Field label="Description">
                  <TextArea
                    value={siteForm.description}
                    onChange={(event) =>
                      setSiteForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional note"
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={submitting || !siteForm.name.trim()}
                    className="form-button form-button-full-width"
                  >
                    Add Site
                  </button>
                </div>
              </form>

              {sites.length ? (
                <div className="selection-list">
                  {sites.map((site) => (
                    <button
                      key={site._id}
                      type="button"
                      onClick={() => setSelectedSiteId(site._id)}
                      className={`selection-item ${
                        site._id === selectedSiteId
                          ? "selection-item-selected"
                          : "selection-item-unselected"
                      }`}
                    >
                      <div className="selection-item-name">{site.name}</div>
                      <div
                        className={`selection-item-description ${
                          site._id === selectedSiteId
                            ? "selection-item-description-selected"
                            : "selection-item-description-unselected"
                        }`}
                      >
                        {site.description || "No description"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState>
                  No sites yet. Create one to unlock the rest of the chain.
                </EmptyState>
              )}
            </Panel>

            <Panel
              title="Floor Maps"
              subtitle={
                selectedSite
                  ? `Attached to ${selectedSite.name}.`
                  : "Select a site first."
              }
            >
              <form
                className="form-grid form-grid-cols-2"
                onSubmit={handleFloorMapSubmit}
              >
                <Field label="Name">
                  <TextInput
                    value={floorMapForm.name}
                    onChange={(event) =>
                      setFloorMapForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ground Floor"
                  />
                </Field>
                <Field label="Image URL">
                  <TextInput
                    value={floorMapForm.imageUrl}
                    onChange={(event) =>
                      setFloorMapForm((current) => ({
                        ...current,
                        imageUrl: event.target.value,
                      }))
                    }
                    placeholder="https://example.com/floor-map.png"
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={
                      submitting || !selectedSiteId || !floorMapForm.name.trim()
                    }
                    className="form-button form-button-full-width"
                  >
                    Add Floor Map
                  </button>
                </div>
              </form>

              {floorMapsForSite.length ? (
                <div className="selection-list">
                  {floorMapsForSite.map((floorMap) => (
                    <button
                      key={floorMap._id}
                      type="button"
                      onClick={() => setSelectedFloorMapId(floorMap._id)}
                      className={`selection-item ${
                        floorMap._id === selectedFloorMapId
                          ? "selection-item-selected"
                          : "selection-item-unselected"
                      }`}
                    >
                      <div className="selection-item-name">{floorMap.name}</div>
                      <div
                        className={`selection-item-description ${
                          floorMap._id === selectedFloorMapId
                            ? "selection-item-description-selected"
                            : "selection-item-description-unselected"
                        }`}
                      >
                        {floorMap.imageUrl || "No image URL"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState>No floor maps for this site yet.</EmptyState>
              )}
            </Panel>

            <Panel
              title="Storage Units"
              subtitle={
                selectedFloorMap
                  ? `Placed on ${selectedFloorMap.name}.`
                  : "Select a floor map first."
              }
            >
              <form
                className="form-grid form-grid-cols-2"
                onSubmit={handleCreateStorageUnit}
              >
                <TextInput
                  label="Name"
                  value={unitForm.name}
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Shelf A"
                />
                <SelectInput
                  label="Type"
                  value={unitForm.type}
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      type: event.target.value,
                    }))
                  }
                  options={STORAGE_UNIT_TYPES.map((type) => ({
                    value: type,
                    label: type,
                  }))}
                />
                <NumberInput
                  label="X"
                  value={unitForm.x}
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      x: event.target.value,
                    }))
                  }
                />
                <NumberInput
                  label="Y"
                  value={unitForm.y}
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      y: event.target.value,
                    }))
                  }
                />
                <NumberInput
                  label="Width"
                  value={unitForm.width}
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      width: event.target.value,
                    }))
                  }
                />
                <NumberInput
                  label="Height"
                  value={unitForm.height}
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      height: event.target.value,
                    }))
                  }
                />
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedFloorMapId ||
                    !unitForm.name.trim() ||
                    !hasValidUnitPosition(unitForm) ||
                    Number(unitForm.width) < 1 ||
                    Number(unitForm.height) < 1
                  }
                  className="form-button form-button-full-width"
                >
                  Edit Selected Floor Map
                </button>
              </form>

              {storageUnitsForFloorMap.length ? (
                <div className="selection-list">
                  {storageUnitsForFloorMap.map((unit) => (
                    <button
                      key={unit._id}
                      type="button"
                      onClick={() => setSelectedStorageUnitId(unit._id)}
                      className={`selection-item ${
                        unit._id === selectedStorageUnitId
                          ? "selection-item-selected"
                          : "selection-item-unselected"
                      }`}
                    >
                      <div className="unit-list-item-flex">
                        <span className="selection-item-name">{unit.name}</span>
                        <span
                          className={`unit-type-badge ${
                            unit._id === selectedStorageUnitId
                              ? "unit-type-badge-selected"
                              : "unit-type-badge-unselected"
                          }`}
                        >
                          {unit.type}
                        </span>
                      </div>
                      <div
                        className={`unit-list-item-meta ${
                          unit._id === selectedStorageUnitId
                            ? "unit-list-item-meta-selected"
                            : "unit-list-item-meta-unselected"
                        }`}
                      >
                        {`x:${unit.position.x} y:${unit.position.y} w:${unit.position.width} h:${unit.position.height}`}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState>No storage units on this floor map yet.</EmptyState>
              )}
            </Panel>

            <Panel
              title="Storage Locations"
              subtitle={
                selectedStorageUnit
                  ? `Attached to ${selectedStorageUnit.name}.`
                  : "Select a storage unit first."
              }
            >
              <form
                className="form-grid form-grid-cols-2"
                onSubmit={handleCreateStorageLocation}
              >
                <TextInput
                  label="Name"
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Top Shelf"
                />
                <TextInput
                  label="Code"
                  value={locationForm.code}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="SH-A-01"
                />
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedStorageUnitId ||
                    !locationForm.name.trim() ||
                    !locationForm.code.trim()
                  }
                  className="form-button form-button-full-width"
                >
                  Manage Units
                </button>
              </form>

              {locationsForStorageUnit.length ? (
                <div className="selection-list">
                  {locationsForStorageUnit.map((location) => (
                    <div key={location._id} className="location-list-item">
                      <div className="location-list-details">
                        <div className="location-list-item-name">
                          {location.name}
                        </div>
                        <div className="location-list-item-code">
                          {location.code}
                        </div>
                      </div>
                      <button className="location-list-item-view-image" 
                      onClick = {()=>{
                        setSelectedLocation(location);
                        setImageModalOpen(true);
                      }}>
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

          <div className="locations-page-right-column">
            <Panel
              title="Relationship Summary"
              subtitle="Quick sanity check of what is currently selected."
            >
              <dl className="relationship-summary-list">
                <div className="relationship-summary-item">
                  <dt className="relationship-summary-label">Site</dt>
                  <dd className="relationship-summary-value">
                    {selectedSite?.name || "None selected"}
                  </dd>
                </div>
                <div className="relationship-summary-item">
                  <dt className="relationship-summary-label">Floor Map</dt>
                  <dd className="relationship-summary-value">
                    {selectedFloorMap?.name || "None selected"}
                  </dd>
                </div>
                <div className="relationship-summary-item">
                  <dt className="relationship-summary-label">Storage Unit</dt>
                  <dd className="relationship-summary-value">
                    {selectedStorageUnit?.name || "None selected"}
                  </dd>
                </div>
                <div className="relationship-summary-item">
                  <dt className="relationship-summary-label">
                    Storage Locations
                  </dt>
                  <dd className="relationship-summary-value">
                    {locationsForStorageUnit.length}
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel
              title="Floor Map Preview"
              subtitle="Simple visual check for storage-unit position values."
            >
              <div className="floor-map-preview-container">
                <div className="floor-map-preview-canvas">
                  {storageUnitsForFloorMap.map((unit) => (
                    <button
                      key={unit._id}
                      type="button"
                      onClick={() => setSelectedStorageUnitId(unit._id)}
                      className={`floor-map-unit-button ${
                        unit._id === selectedStorageUnitId
                          ? "floor-map-unit-selected"
                          : "floor-map-unit-unselected"
                      }`}
                      style={{
                        left: `${unit.position.x}px`,
                        top: `${unit.position.y}px`,
                        width: `${unit.position.width}px`,
                        height: `${unit.position.height}px`,
                      }}
                    >
                      <div className="floor-map-unit-name">{unit.name}</div>
                      <div
                        className={
                          unit._id === selectedStorageUnitId
                            ? "floor-map-unit-type-selected"
                            : "floor-map-unit-type-unselected"
                        }
                      >
                        {unit.type}
                      </div>
                    </button>
                  ))}

                  {!storageUnitsForFloorMap.length ? (
                    <div className="floor-map-empty-state">
                      Add a storage unit to see it plotted here.
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    
    {imageModalOpen && currentLocation && (
        <div className="location-image-modal"
          onClick={() => {
            setImageModalOpen(false);
            setSelectedLocation(null);
          }}>
          <div className="location-image-container" 
              onClick={(e) => e.stopPropagation()}>
            <h2 className="location-image-title">
              {currentLocation.name} ({currentLocation.code})
            </h2>

            <div className="location-image-display">
                  <img
                    src={currentLocation.imageUrl}
                    alt={currentLocation.name}
                    className="location-image"
                  />
            </div>

            <div className="location-image-footer">

            {status.message ? (
            <div
              className={`status-message ${
                status.type === "error"
                  ? "status-message-error"
                  : "status-message-success"
              }`}
            >
              {status.message}
            </div>
                ) : null}

            <div className="location-image-footer-buttons">
              <button
                className="location-image-exit"
                onClick = {() => {
                  setImageModalOpen(false);
                  setSelectedLocation(null);
                }}>
                  Cancel
                </button>

                <input
                  type = "file"
                  accept = "image/*"
                  ref = {fileInputRef}
                  style = {{display: 'none'}}
                  onChange = {handleUpload}
                />
                <button
                  className="location-image-upload"
                  onClick = {() => fileInputRef.current.click()}>
                    Upload New
                </button>
                </div>
            </div>
                
          </div>
        </div>
    )}


    </div>
  );
}
