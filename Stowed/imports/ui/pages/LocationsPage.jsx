import { useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from "/imports/api/locations/collections";
import { ProductRecords } from "/imports/api/products/collections";
import { isImageFile, uploadImageToServer } from "/imports/api/upload";
import {
  DEFAULT_STOCKTAKE_INTERVAL_DAYS,
  getLocationStocktakeStatus,
  isValidStocktakeInterval,
  MAX_STOCKTAKE_INTERVAL_DAYS,
  STOCKTAKE_STATUS,
} from "../../api/locations/stocktake";
import "../Global.css";
import "./LocationsPage.css";

const TABS = {
  LOCATIONS: "locations",
  FLOOR_MAPS: "floor-maps",
  SITES: "sites",
};

const EMPTY_FORMS = {
  location: { storageUnitId: "", name: "", code: "", imageUrl: "" },
  floorMap: { siteId: "", name: "", imageUrl: "" },
  site: {
    name: "",
    description: "",
    stocktakeIntervalDays: String(DEFAULT_STOCKTAKE_INTERVAL_DAYS),
  },
};

function callMethod(methodName, params) {
  return Meteor.callAsync(methodName, params);
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Modal({ title, children, onClose }) {
  return (
    <div className="locations-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="locations-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="locations-modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label className="locations-form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }) {
  const label = {
    [STOCKTAKE_STATUS.OVERDUE]: "Overdue",
    [STOCKTAKE_STATUS.DUE_SOON]: "Due soon",
    [STOCKTAKE_STATUS.OK]: "Current",
  }[status];
  return <span className={`locations-status-badge ${status}`}>{label}</span>;
}

export function LocationsPage() {
  const { role } = useAuth();
  const canManage = hasClientPermission(role, "locations.manage");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = Object.values(TABS).includes(requestedTab) ? requestedTab : TABS.LOCATIONS;

  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [stocktakeFilter, setStocktakeFilter] = useState("");
  const [formMode, setFormMode] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORMS.location);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { loading, sites, floorMaps, storageUnits, storageLocations, productRecords } =
    useTracker(() => {
      const locationsHandle = Meteor.subscribe("locations.all");
      const recordsHandle = Meteor.subscribe("productRecords");
      return {
        loading: !locationsHandle.ready() || !recordsHandle.ready(),
        sites: Sites.find({}, { sort: { name: 1 } }).fetch(),
        floorMaps: FloorMaps.find({}, { sort: { name: 1 } }).fetch(),
        storageUnits: StorageUnits.find({}, { sort: { name: 1 } }).fetch(),
        storageLocations: StorageLocations.find({}, { sort: { name: 1 } }).fetch(),
        productRecords: ProductRecords.find({}).fetch(),
      };
    }, []);

  const indexes = useMemo(() => {
    const sitesById = new Map(sites.map((site) => [site._id, site]));
    const floorMapsById = new Map(floorMaps.map((floorMap) => [floorMap._id, floorMap]));
    const unitsById = new Map(storageUnits.map((unit) => [unit._id, unit]));
    const itemCountByLocationId = new Map();
    for (const record of productRecords) {
      itemCountByLocationId.set(
        record.locationId,
        (itemCountByLocationId.get(record.locationId) ?? 0) + 1,
      );
    }
    return { sitesById, floorMapsById, unitsById, itemCountByLocationId };
  }, [sites, floorMaps, storageUnits, productRecords]);

  const locationRows = useMemo(() => {
    const now = new Date();
    return storageLocations.map((location) => {
      const unit = indexes.unitsById.get(location.storageUnitId);
      const floorMap = unit ? indexes.floorMapsById.get(unit.floorMapId) : null;
      const site = floorMap ? indexes.sitesById.get(floorMap.siteId) : null;
      const intervalDays = site?.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS;
      return {
        location,
        unit,
        floorMap,
        site,
        intervalDays,
        stocktakeStatus: getLocationStocktakeStatus(location.lastStocktakeAt, intervalDays, now),
        itemCount: indexes.itemCountByLocationId.get(location._id) ?? 0,
        path: [site?.name, floorMap?.name, unit?.name].filter(Boolean).join(" › "),
      };
    });
  }, [storageLocations, indexes]);

  const visibleLocations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return locationRows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        [row.location.name, row.location.code, row.path]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesSite = !siteFilter || row.site?._id === siteFilter;
      const matchesStocktake = !stocktakeFilter || row.stocktakeStatus === stocktakeFilter;
      return matchesQuery && matchesSite && matchesStocktake;
    });
  }, [locationRows, query, siteFilter, stocktakeFilter]);

  const counts = useMemo(() => {
    const overdue = locationRows.filter(
      (row) => row.stocktakeStatus === STOCKTAKE_STATUS.OVERDUE,
    ).length;
    const dueSoon = locationRows.filter(
      (row) => row.stocktakeStatus === STOCKTAKE_STATUS.DUE_SOON,
    ).length;
    return { overdue, dueSoon };
  }, [locationRows]);

  function selectTab(tab) {
    setSearchParams(tab === TABS.LOCATIONS ? {} : { tab });
    setQuery("");
    setSiteFilter("");
    setStocktakeFilter("");
    setStatus({ type: "", message: "" });
  }

  function openCreate() {
    setEditing(null);
    setFormMode(activeTab);
    if (activeTab === TABS.LOCATIONS) {
      setForm({ ...EMPTY_FORMS.location, storageUnitId: storageUnits[0]?._id ?? "" });
    } else if (activeTab === TABS.FLOOR_MAPS) {
      setForm({ ...EMPTY_FORMS.floorMap, siteId: sites[0]?._id ?? "" });
    } else {
      setForm(EMPTY_FORMS.site);
    }
  }

  function openEdit(type, record) {
    setEditing(record);
    setFormMode(type);
    if (type === TABS.LOCATIONS) {
      setForm({
        storageUnitId: record.storageUnitId,
        name: record.name ?? "",
        code: record.code ?? "",
        imageUrl: record.imageUrl ?? "",
      });
    } else if (type === TABS.FLOOR_MAPS) {
      setForm({ siteId: record.siteId, name: record.name, imageUrl: record.imageUrl ?? "" });
    } else {
      setForm({
        name: record.name,
        description: record.description ?? "",
        stocktakeIntervalDays: String(
          record.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS,
        ),
      });
    }
  }

  function closeForm() {
    if (submitting || uploading) return;
    setFormMode(null);
    setEditing(null);
  }

  async function saveForm(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", message: "" });
    try {
      if (formMode === TABS.LOCATIONS) {
        const params = {
          storageUnitId: form.storageUnitId,
          name: form.name.trim(),
          code: form.code.trim(),
          imageUrl: form.imageUrl.trim(),
        };
        if (editing) {
          await callMethod("storageLocations.update", {
            storageLocationId: editing._id,
            ...params,
          });
        } else {
          await callMethod("storageLocations.create", params);
        }
      } else if (formMode === TABS.FLOOR_MAPS) {
        if (editing) {
          await callMethod("floorMaps.update", {
            floorMapId: editing._id,
            siteId: form.siteId,
            name: form.name.trim(),
            imageUrl: form.imageUrl.trim(),
            floorSize: editing.floorSize ?? {},
            settings: editing.settings ?? {},
          });
        } else {
          await callMethod("floorMaps.create", {
            siteId: form.siteId,
            name: form.name.trim(),
            imageUrl: form.imageUrl.trim(),
          });
        }
      } else {
        const stocktakeIntervalDays = Number(form.stocktakeIntervalDays);
        if (!isValidStocktakeInterval(stocktakeIntervalDays)) {
          throw new Error(
            `Stocktake interval must be a whole number between 1 and ${MAX_STOCKTAKE_INTERVAL_DAYS} days.`,
          );
        }
        if (editing) {
          await callMethod("sites.update", {
            siteId: editing._id,
            name: form.name.trim(),
            description: form.description.trim(),
            stocktakeIntervalDays,
          });
        } else {
          await callMethod("sites.create", {
            name: form.name.trim(),
            description: form.description.trim(),
            stocktakeIntervalDays,
          });
        }
      }
      setFormMode(null);
      setEditing(null);
      setStatus({ type: "success", message: `${editing ? "Changes" : "Record"} saved.` });
    } catch (error) {
      setStatus({ type: "error", message: error.reason || error.message || "Could not save." });
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      setStatus({ type: "error", message: "Choose a valid image file." });
      return;
    }
    setUploading(true);
    try {
      const imageUrl = await uploadImageToServer(file);
      setForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      setStatus({ type: "error", message: error.reason || "Image upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    setStatus({ type: "", message: "" });
    try {
      if (deleteTarget.type === TABS.LOCATIONS) {
        await callMethod("storageLocations.delete", { storageLocationId: deleteTarget.record._id });
      } else if (deleteTarget.type === TABS.FLOOR_MAPS) {
        await callMethod("floorMaps.delete", { floorMapId: deleteTarget.record._id });
      } else {
        await callMethod("sites.delete", { siteId: deleteTarget.record._id });
      }
      setDeleteTarget(null);
      setStatus({ type: "success", message: "Deleted." });
    } catch (error) {
      setStatus({ type: "error", message: error.reason || error.message || "Could not delete." });
    } finally {
      setSubmitting(false);
    }
  }

  const tabConfig = [
    { id: TABS.LOCATIONS, label: "Storage Locations", count: storageLocations.length },
    { id: TABS.FLOOR_MAPS, label: "Floor Maps", count: floorMaps.length },
    { id: TABS.SITES, label: "Sites", count: sites.length },
  ];
  const primaryLabel = {
    [TABS.LOCATIONS]: "Add location",
    [TABS.FLOOR_MAPS]: "Add floor map",
    [TABS.SITES]: "Add site",
  }[activeTab];

  return (
    <div className="product-detail-container locations-directory">
      <div className="product-detail-header">
        <div className="header-top locations-heading-row">
          <div>
            <h1 className="header-title">
              Location <em>Directory</em>
            </h1>
            <p className="locations-page-subtitle">
              Browse storage locations and manage your organisation’s physical structure.
            </p>
          </div>
          {canManage && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              + {primaryLabel}
            </button>
          )}
        </div>
      </div>

      <div className="locations-content">
        {status.message && (
          <div className={`locations-message ${status.type}`} role="status">
            {status.message}
          </div>
        )}

        <div className="locations-tabs" role="tablist" aria-label="Location directory views">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label} <span>{tab.count}</span>
            </button>
          ))}
        </div>

        {activeTab === TABS.LOCATIONS && (
          <>
            <div className="locations-summary-grid">
              <div>
                <strong>{storageLocations.length}</strong>
                <span>Total locations</span>
              </div>
              <div>
                <strong>{counts.overdue}</strong>
                <span>Overdue</span>
              </div>
              <div>
                <strong>{counts.dueSoon}</strong>
                <span>Due soon</span>
              </div>
              <div>
                <strong>{sites.length}</strong>
                <span>Sites</span>
              </div>
            </div>
            <div className="locations-toolbar">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, code, or physical path…"
                aria-label="Search storage locations"
              />
              <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {site.name}
                  </option>
                ))}
              </select>
              <select
                value={stocktakeFilter}
                onChange={(event) => setStocktakeFilter(event.target.value)}
              >
                <option value="">All stocktake states</option>
                <option value={STOCKTAKE_STATUS.OVERDUE}>Overdue</option>
                <option value={STOCKTAKE_STATUS.DUE_SOON}>Due soon</option>
                <option value={STOCKTAKE_STATUS.OK}>Current</option>
              </select>
            </div>
            <div className="locations-table-shell">
              {loading ? (
                <div className="locations-empty">Loading locations…</div>
              ) : visibleLocations.length === 0 ? (
                <div className="locations-empty">
                  No storage locations match the current filters.
                </div>
              ) : (
                <table className="locations-table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Physical path</th>
                      <th>Products</th>
                      <th>Stocktake</th>
                      <th>Last counted</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLocations.map((row) => (
                      <tr key={row.location._id}>
                        <td>
                          <Link
                            className="locations-name-link"
                            to={`/locations/${row.location._id}`}
                          >
                            <strong>{row.location.name || "Unnamed location"}</strong>
                          </Link>
                          <span className="locations-code">{row.location.code || "No code"}</span>
                        </td>
                        <td>
                          <span className="locations-path">{row.path || "Unlinked location"}</span>
                        </td>
                        <td>{row.itemCount}</td>
                        <td>
                          <StatusBadge status={row.stocktakeStatus} />
                        </td>
                        <td>{formatDate(row.location.lastStocktakeAt)}</td>
                        <td>
                          <div className="locations-row-actions">
                            <Link to={`/locations/${row.location._id}`}>View</Link>
                            {row.floorMap && (
                              <button
                                type="button"
                                onClick={() => navigate(`/floor-map/${row.floorMap._id}`)}
                              >
                                Open map
                              </button>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => openEdit(TABS.LOCATIONS, row.location)}
                              >
                                Edit
                              </button>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  setDeleteTarget({ type: TABS.LOCATIONS, record: row.location })
                                }
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === TABS.FLOOR_MAPS && (
          <div className="locations-card-grid">
            {loading ? (
              <div className="locations-empty">Loading floor maps…</div>
            ) : floorMaps.length === 0 ? (
              <div className="locations-empty">No floor maps yet.</div>
            ) : (
              floorMaps.map((floorMap) => {
                const site = indexes.sitesById.get(floorMap.siteId);
                const units = storageUnits.filter((unit) => unit.floorMapId === floorMap._id);
                const unitIds = new Set(units.map((unit) => unit._id));
                const locationCount = storageLocations.filter((location) =>
                  unitIds.has(location.storageUnitId),
                ).length;
                return (
                  <article className="locations-entity-card" key={floorMap._id}>
                    <div className="locations-card-eyebrow">{site?.name || "Unlinked site"}</div>
                    <h2>{floorMap.name}</h2>
                    <div className="locations-card-metrics">
                      <span>
                        <strong>{units.length}</strong> units
                      </span>
                      <span>
                        <strong>{locationCount}</strong> locations
                      </span>
                    </div>
                    <div className="locations-card-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => navigate(`/floor-map/${floorMap._id}`)}
                      >
                        Open map
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEdit(TABS.FLOOR_MAPS, floorMap)}
                        >
                          Edit
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() =>
                            setDeleteTarget({ type: TABS.FLOOR_MAPS, record: floorMap })
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {activeTab === TABS.SITES && (
          <div className="locations-card-grid">
            {loading ? (
              <div className="locations-empty">Loading sites…</div>
            ) : sites.length === 0 ? (
              <div className="locations-empty">No sites yet.</div>
            ) : (
              sites.map((site) => {
                const maps = floorMaps.filter((floorMap) => floorMap.siteId === site._id);
                const mapIds = new Set(maps.map((floorMap) => floorMap._id));
                const units = storageUnits.filter((unit) => mapIds.has(unit.floorMapId));
                const unitIds = new Set(units.map((unit) => unit._id));
                const locationCount = storageLocations.filter((location) =>
                  unitIds.has(location.storageUnitId),
                ).length;
                return (
                  <article className="locations-entity-card" key={site._id}>
                    <div className="locations-card-eyebrow">Site</div>
                    <h2>{site.name}</h2>
                    <p>{site.description || "No description."}</p>
                    <div className="locations-card-metrics">
                      <span>
                        <strong>{maps.length}</strong> floor maps
                      </span>
                      <span>
                        <strong>{locationCount}</strong> locations
                      </span>
                    </div>
                    <div className="locations-schedule">
                      Stocktake every{" "}
                      <strong>
                        {site.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS} days
                      </strong>
                    </div>
                    {canManage && (
                      <div className="locations-card-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEdit(TABS.SITES, site)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => setDeleteTarget({ type: TABS.SITES, record: site })}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>

      {formMode && (
        <Modal
          title={`${editing ? "Edit" : "Add"} ${formMode === TABS.LOCATIONS ? "storage location" : formMode === TABS.FLOOR_MAPS ? "floor map" : "site"}`}
          onClose={closeForm}
        >
          <form className="locations-modal-form" onSubmit={saveForm}>
            {formMode === TABS.LOCATIONS && (
              <>
                <FormField label="Storage unit">
                  <select
                    required
                    value={form.storageUnitId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, storageUnitId: event.target.value }))
                    }
                  >
                    <option value="">Select a storage unit</option>
                    {storageUnits.map((unit) => {
                      const floorMap = indexes.floorMapsById.get(unit.floorMapId);
                      const site = floorMap ? indexes.sitesById.get(floorMap.siteId) : null;
                      return (
                        <option key={unit._id} value={unit._id}>
                          {[site?.name, floorMap?.name, unit.name].filter(Boolean).join(" › ")}
                        </option>
                      );
                    })}
                  </select>
                </FormField>
                <FormField label="Location name">
                  <input
                    required
                    maxLength="100"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Location code">
                  <input
                    required
                    maxLength="50"
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, code: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Image">
                  <input type="file" accept="image/*" disabled={uploading} onChange={uploadImage} />
                  <small>
                    {uploading ? "Uploading…" : form.imageUrl ? "Image ready to save." : "Optional"}
                  </small>
                </FormField>
              </>
            )}
            {formMode === TABS.FLOOR_MAPS && (
              <>
                <FormField label="Site">
                  <select
                    required
                    value={form.siteId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, siteId: event.target.value }))
                    }
                  >
                    <option value="">Select a site</option>
                    {sites.map((site) => (
                      <option key={site._id} value={site._id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Floor map name">
                  <input
                    required
                    maxLength="100"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Background image URL">
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, imageUrl: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </FormField>
              </>
            )}
            {formMode === TABS.SITES && (
              <>
                <FormField label="Site name">
                  <input
                    required
                    maxLength="100"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Description">
                  <textarea
                    maxLength="500"
                    rows="3"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Stocktake interval (days)">
                  <input
                    required
                    type="number"
                    min="1"
                    max={MAX_STOCKTAKE_INTERVAL_DAYS}
                    step="1"
                    value={form.stocktakeIntervalDays}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        stocktakeIntervalDays: event.target.value,
                      }))
                    }
                  />
                  <small>
                    Locations at this site become overdue after this many days without a stocktake.
                  </small>
                </FormField>
              </>
            )}
            <div className="locations-modal-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting || uploading}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Delete ${deleteTarget.record.name || "record"}?`}
          onClose={() => setDeleteTarget(null)}
        >
          <p className="locations-delete-copy">
            This only succeeds when the record has no dependent floor maps, storage units,
            locations, or inventory.
          </p>
          <div className="locations-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={submitting}
              onClick={confirmDelete}
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
