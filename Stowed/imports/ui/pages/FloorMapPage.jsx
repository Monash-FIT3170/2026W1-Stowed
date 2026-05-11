import { useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { FloorMaps, Sites, StorageLocations, StorageUnits } from '/imports/api/locations/collections';

const STORAGE_UNIT_TYPES = ['shelf', 'cabinet', 'rack', 'drawer', 'fridge', 'other'];

const DEFAULT_UNIT_FORM = {
  name: '',
  type: 'shelf',
  x: '24',
  y: '24',
  width: '120',
  height: '72',
};

const DEFAULT_LOCATION_FORM = {
  name: '',
  code: '',
};

function callMethod(methodName, params) {
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

function hasValidUnitPosition(unitForm) {
  return ['x', 'y', 'width', 'height'].every((key) => {
    const value = Number(unitForm[key]);
    return Number.isFinite(value) && value >= 0;
  });
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
    />
  );
}

function SelectInput({ options, ...props }) {
  return (
    <select
      {...props}
      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm text-zinc-600"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FloorMapPage() {
  const navigate = useNavigate();
  const { floorMapId: routeFloorMapId } = useParams();

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedFloorMapId, setSelectedFloorMapId] = useState(routeFloorMapId || '');
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState('');
  const [editingUnitId, setEditingUnitId] = useState('');
  const [editingLocationId, setEditingLocationId] = useState('');
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [unitForm, setUnitForm] = useState(DEFAULT_UNIT_FORM);
  const [locationForm, setLocationForm] = useState(DEFAULT_LOCATION_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const { isLoading, sites, floorMaps, storageUnits, storageLocations } = useTracker(() => {
    const handle = Meteor.subscribe('locations.all');

    return {
      isLoading: !handle.ready(),
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      storageUnits: StorageUnits.find({}, { sort: { createdAt: 1 } }).fetch(),
      storageLocations: StorageLocations.find({}, { sort: { createdAt: 1 } }).fetch(),
    };
  }, []);

  const selectedFloorMap = useMemo(
    () => floorMaps.find((floorMap) => floorMap._id === selectedFloorMapId) ?? null,
    [floorMaps, selectedFloorMapId],
  );

  const floorMapsForSite = useMemo(
    () => floorMaps.filter((floorMap) => floorMap.siteId === selectedSiteId),
    [floorMaps, selectedSiteId],
  );

  const storageUnitsForFloorMap = useMemo(
    () => storageUnits.filter((unit) => unit.floorMapId === selectedFloorMapId),
    [selectedFloorMapId, storageUnits],
  );

  const selectedStorageUnit = useMemo(
    () => storageUnits.find((unit) => unit._id === selectedStorageUnitId) ?? null,
    [selectedStorageUnitId, storageUnits],
  );

  const storageLocationsForUnit = useMemo(
    () => storageLocations.filter((location) => location.storageUnitId === selectedStorageUnitId),
    [selectedStorageUnitId, storageLocations],
  );

  const selectedSite = useMemo(() => {
    if (!selectedFloorMap) {
      return sites.find((site) => site._id === selectedSiteId) ?? null;
    }

    return sites.find((site) => site._id === selectedFloorMap.siteId) ?? null;
  }, [selectedFloorMap, selectedSiteId, sites]);

  useEffect(() => {
    if (!floorMaps.length) {
      setSelectedFloorMapId('');
      setSelectedSiteId('');
      return;
    }

    if (routeFloorMapId && floorMaps.some((floorMap) => floorMap._id === routeFloorMapId)) {
      setSelectedFloorMapId(routeFloorMapId);
      return;
    }

    if (!selectedFloorMapId || !floorMaps.some((floorMap) => floorMap._id === selectedFloorMapId)) {
      setSelectedFloorMapId(floorMaps[0]._id);
    }
  }, [floorMaps, routeFloorMapId, selectedFloorMapId]);

  useEffect(() => {
    if (selectedFloorMap) {
      setSelectedSiteId(selectedFloorMap.siteId);
    }
  }, [selectedFloorMap]);

  useEffect(() => {
    if (!storageUnitsForFloorMap.length) {
      setSelectedStorageUnitId('');
      return;
    }

    if (!storageUnitsForFloorMap.some((unit) => unit._id === selectedStorageUnitId)) {
      setSelectedStorageUnitId(storageUnitsForFloorMap[0]._id);
    }
  }, [selectedStorageUnitId, storageUnitsForFloorMap]);

  function resetUnitForm() {
    setUnitForm(DEFAULT_UNIT_FORM);
    setEditingUnitId('');
  }

  function resetLocationForm() {
    setLocationForm(DEFAULT_LOCATION_FORM);
    setEditingLocationId('');
    setShowLocationForm(false);
  }

  async function runAction(action, successMessage) {
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      await action();
      setStatus({ type: 'success', message: successMessage });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.reason || error.message || 'Something went wrong.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectSite(event) {
    const siteId = event.target.value;
    setSelectedSiteId(siteId);

    const nextFloorMap = floorMaps.find((floorMap) => floorMap.siteId === siteId);
    if (nextFloorMap) {
      navigate(`/floor-map/${nextFloorMap._id}`);
      return;
    }

    setSelectedFloorMapId('');
    navigate('/floor-map');
  }

  function handleSelectFloorMap(event) {
    const floorMapId = event.target.value;
    setSelectedFloorMapId(floorMapId);

    if (floorMapId) {
      navigate(`/floor-map/${floorMapId}`);
    } else {
      navigate('/floor-map');
    }
  }

  function openCreateUnitModal() {
    resetUnitForm();
    setShowUnitModal(true);
  }

  function openEditUnitModal() {
    if (!selectedStorageUnit) {
      return;
    }

    setEditingUnitId(selectedStorageUnit._id);
    setUnitForm({
      name: selectedStorageUnit.name,
      type: selectedStorageUnit.type,
      x: String(selectedStorageUnit.position.x),
      y: String(selectedStorageUnit.position.y),
      width: String(selectedStorageUnit.position.width),
      height: String(selectedStorageUnit.position.height),
    });
    setShowUnitModal(true);
  }

  function startCreateLocation() {
    resetLocationForm();
    setShowLocationForm(true);
  }

  function startEditLocation(location) {
    setEditingLocationId(location._id);
    setLocationForm({
      name: location.name,
      code: location.code,
    });
    setShowLocationForm(true);
  }

  async function handleUnitSubmit(event) {
    event.preventDefault();

    if (!selectedFloorMapId) {
      setStatus({ type: 'error', message: 'Select a floor map first.' });
      return;
    }

    await runAction(async () => {
      if (!hasValidUnitPosition(unitForm) || Number(unitForm.width) < 1 || Number(unitForm.height) < 1) {
        throw new Error('Position values must be numbers, and width/height must be at least 1.');
      }

      const payload = {
        floorMapId: selectedFloorMapId,
        name: unitForm.name.trim(),
        type: unitForm.type,
        position: {
          x: Number(unitForm.x),
          y: Number(unitForm.y),
          width: Number(unitForm.width),
          height: Number(unitForm.height),
        },
      };

      if (editingUnitId) {
        await callMethod('storageUnits.update', { storageUnitId: editingUnitId, ...payload });
      } else {
        await callMethod('storageUnits.create', payload);
      }

      setShowUnitModal(false);
      resetUnitForm();
    }, editingUnitId ? 'Storage unit updated.' : 'Storage unit created.');
  }

  async function handleDeleteUnit() {
    if (!selectedStorageUnit || !window.confirm(`Delete storage unit "${selectedStorageUnit.name}"?`)) {
      return;
    }

    await runAction(async () => {
      await callMethod('storageUnits.delete', { storageUnitId: selectedStorageUnit._id });
      resetLocationForm();
    }, 'Storage unit deleted.');
  }

  async function handleLocationSubmit(event) {
    event.preventDefault();

    if (!selectedStorageUnitId) {
      setStatus({ type: 'error', message: 'Select a storage unit first.' });
      return;
    }

    await runAction(async () => {
      const payload = {
        storageUnitId: selectedStorageUnitId,
        name: locationForm.name.trim(),
        code: locationForm.code.trim(),
      };

      if (editingLocationId) {
        await callMethod('storageLocations.update', {
          storageLocationId: editingLocationId,
          ...payload,
        });
      } else {
        await callMethod('storageLocations.create', payload);
      }

      resetLocationForm();
    }, editingLocationId ? 'Storage location updated.' : 'Storage location created.');
  }

  async function handleDeleteLocation(location) {
    if (!window.confirm(`Delete storage location "${location.name}"?`)) {
      return;
    }

    await runAction(async () => {
      await callMethod('storageLocations.delete', { storageLocationId: location._id });

      if (editingLocationId === location._id) {
        resetLocationForm();
      }
    }, 'Storage location deleted.');
  }

  if (!isLoading && !floorMaps.length) {
    return (
      <div className="min-h-full bg-zinc-100">
        <div className="mx-auto max-w-5xl p-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h1 className="mb-2 text-2xl font-semibold text-zinc-950">Floor Map Workspace</h1>
            <p className="mb-4 text-sm text-zinc-600">
              Create a site and floor map before managing storage units.
            </p>
            <Link
              to="/locations"
              className="inline-flex rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
            >
              Go to Locations Setup
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-100">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Floor Map Workspace</h1>
            <p className="text-sm text-zinc-600">
              Manage storage units on the map, then drill into the selected unit to manage storage
              locations inside it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/locations"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
            >
              Back to Locations Setup
            </Link>
            <button
              type="button"
              onClick={openCreateUnitModal}
              disabled={!selectedFloorMapId}
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              Create Storage Unit
            </button>
          </div>
        </div>

        {status.message ? (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              status.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {status.message}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-2">
          <Field label="Site">
            <SelectInput
              value={selectedSiteId}
              onChange={handleSelectSite}
              options={sites.map((site) => ({ value: site._id, label: site.name }))}
            />
          </Field>
          <Field label="Floor Map">
            <SelectInput
              value={selectedFloorMapId}
              onChange={handleSelectFloorMap}
              options={[
                { value: '', label: floorMapsForSite.length ? 'Select a floor map' : 'No floor maps for this site' },
                ...floorMapsForSite.map((floorMap) => ({ value: floorMap._id, label: floorMap.name })),
              ]}
            />
          </Field>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">{selectedFloorMap?.name || 'No Floor Map Selected'}</h2>
                <p className="text-sm text-zinc-500">
                  {selectedSite ? `${selectedSite.name}` : 'Select a site and floor map to continue.'}
                </p>
              </div>
              <div className="text-right text-xs text-zinc-400">
                {selectedFloorMap?.imageUrl ? 'Image URL provided' : 'Grid preview only'}
              </div>
            </div>

            <div
              className="relative h-[560px] overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:24px_24px]"
              style={
                selectedFloorMap?.imageUrl
                  ? {
                      backgroundImage: `linear-gradient(to right, rgba(228,228,231,0.9) 1px, transparent 1px), linear-gradient(to bottom, rgba(228,228,231,0.9) 1px, transparent 1px), url(${selectedFloorMap.imageUrl})`,
                      backgroundSize: '24px 24px, 24px 24px, cover',
                      backgroundPosition: '0 0, 0 0, center',
                    }
                  : undefined
              }
            >
              {storageUnitsForFloorMap.map((unit) => (
                <button
                  key={unit._id}
                  type="button"
                  onClick={() => {
                    setSelectedStorageUnitId(unit._id);
                    setShowLocationForm(false);
                  }}
                  className={`absolute overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm ${
                    unit._id === selectedStorageUnitId
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-300 bg-amber-100 text-zinc-800'
                  }`}
                  style={{
                    left: `${unit.position.x}px`,
                    top: `${unit.position.y}px`,
                    width: `${unit.position.width}px`,
                    height: `${unit.position.height}px`,
                  }}
                >
                  <div className="font-semibold">{unit.name}</div>
                  <div className={unit._id === selectedStorageUnitId ? 'text-zinc-300' : 'text-zinc-600'}>
                    {unit.type}
                  </div>
                </button>
              ))}

              {!storageUnitsForFloorMap.length ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                  Create a storage unit to place it on the map.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            {selectedStorageUnit ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-950">{selectedStorageUnit.name}</h2>
                    <p className="text-sm text-zinc-500">
                      {selectedStorageUnit.type} · x:{selectedStorageUnit.position.x} y:{selectedStorageUnit.position.y} w:
                      {selectedStorageUnit.position.width} h:{selectedStorageUnit.position.height}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openEditUnitModal}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
                    >
                      Edit Unit
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteUnit}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                    >
                      Delete Unit
                    </button>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-zinc-900">Storage Locations</h3>
                    <p className="text-sm text-zinc-500">
                      Manage the named positions inside this storage unit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startCreateLocation}
                    className="rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white"
                  >
                    Add Location
                  </button>
                </div>

                {showLocationForm ? (
                  <form
                    className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                    onSubmit={handleLocationSubmit}
                  >
                    <Field label="Name">
                      <TextInput
                        value={locationForm.name}
                        onChange={(event) =>
                          setLocationForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Top Shelf"
                      />
                    </Field>
                    <Field label="Code">
                      <TextInput
                        value={locationForm.code}
                        onChange={(event) =>
                          setLocationForm((current) => ({ ...current, code: event.target.value }))
                        }
                        placeholder="SH-A-01"
                      />
                    </Field>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={submitting || !locationForm.name.trim() || !locationForm.code.trim()}
                        className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                      >
                        {editingLocationId ? 'Save Location' : 'Create Location'}
                      </button>
                      <button
                        type="button"
                        onClick={resetLocationForm}
                        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                {storageLocationsForUnit.length ? (
                  <div className="space-y-2">
                    {storageLocationsForUnit.map((location) => (
                      <div
                        key={location._id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-zinc-900">{location.name}</div>
                            <div className="text-sm text-zinc-500">{location.code}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditLocation(location)}
                              className="rounded-lg border border-zinc-300 px-3 py-1 text-sm text-zinc-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLocation(location)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>No storage locations on this unit yet.</EmptyState>
                )}
              </>
            ) : (
              <EmptyState>
                Select a storage unit on the map to inspect it and manage the storage locations
                inside it.
              </EmptyState>
            )}
          </section>
        </div>
      </div>

      {showUnitModal ? (
        <Modal
          title={editingUnitId ? 'Edit Storage Unit' : 'Create Storage Unit'}
          onClose={() => {
            setShowUnitModal(false);
            resetUnitForm();
          }}
        >
          <form className="grid gap-3" onSubmit={handleUnitSubmit}>
            <Field label="Name">
              <TextInput
                value={unitForm.name}
                onChange={(event) =>
                  setUnitForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Shelf A"
              />
            </Field>
            <Field label="Type">
              <SelectInput
                value={unitForm.type}
                onChange={(event) =>
                  setUnitForm((current) => ({ ...current, type: event.target.value }))
                }
                options={STORAGE_UNIT_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="X">
                <TextInput
                  type="number"
                  min="0"
                  value={unitForm.x}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, x: event.target.value }))
                  }
                />
              </Field>
              <Field label="Y">
                <TextInput
                  type="number"
                  min="0"
                  value={unitForm.y}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, y: event.target.value }))
                  }
                />
              </Field>
              <Field label="Width">
                <TextInput
                  type="number"
                  min="1"
                  value={unitForm.width}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, width: event.target.value }))
                  }
                />
              </Field>
              <Field label="Height">
                <TextInput
                  type="number"
                  min="1"
                  value={unitForm.height}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, height: event.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
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
                className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {editingUnitId ? 'Save Unit' : 'Create Unit'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnitModal(false);
                  resetUnitForm();
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );}
