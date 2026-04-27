import { useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from '/imports/api/locations/collections';

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

function hasValidUnitPosition(unitForm) {
  return ['x', 'y', 'width', 'height'].every((key) => {
    const value = Number(unitForm[key]);
    return Number.isFinite(value) && value >= 0;
  });
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <input
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <textarea
        className="min-h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <select
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
        value={value}
        onChange={onChange}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <input
        type="number"
        min="0"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
        value={value}
        onChange={onChange}
      />
    </label>
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

export function FloorMapPage() {
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedFloorMapId, setSelectedFloorMapId] = useState('');
  const [selectedStorageUnitId, setSelectedStorageUnitId] = useState('');
  const [siteForm, setSiteForm] = useState({ name: '', description: '' });
  const [floorMapForm, setFloorMapForm] = useState({ name: '', imageUrl: '' });
  const [unitForm, setUnitForm] = useState(DEFAULT_UNIT_FORM);
  const [locationForm, setLocationForm] = useState(DEFAULT_LOCATION_FORM);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    if (!sites.length) {
      setSelectedSiteId('');
      return;
    }

    if (!sites.some((site) => site._id === selectedSiteId)) {
      setSelectedSiteId(sites[0]._id);
    }
  }, [sites, selectedSiteId]);

  useEffect(() => {
    if (!floorMapsForSite.length) {
      setSelectedFloorMapId('');
      return;
    }

    if (!floorMapsForSite.some((floorMap) => floorMap._id === selectedFloorMapId)) {
      setSelectedFloorMapId(floorMapsForSite[0]._id);
    }
  }, [floorMapsForSite, selectedFloorMapId]);

  useEffect(() => {
    if (!storageUnitsForFloorMap.length) {
      setSelectedStorageUnitId('');
      return;
    }

    if (!storageUnitsForFloorMap.some((unit) => unit._id === selectedStorageUnitId)) {
      setSelectedStorageUnitId(storageUnitsForFloorMap[0]._id);
    }
  }, [storageUnitsForFloorMap, selectedStorageUnitId]);

  async function runSubmit(action) {
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      await action();
      setStatus({ type: 'success', message: 'Saved.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.reason || error.message || 'Something went wrong.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSite(event) {
    event.preventDefault();

    await runSubmit(async () => {
      await submitMeteorMethod('sites.create', {
        name: siteForm.name.trim(),
        description: siteForm.description.trim(),
      });
      setSiteForm({ name: '', description: '' });
    });
  }

  async function handleCreateFloorMap(event) {
    event.preventDefault();
    if (!selectedSiteId) {
      setStatus({ type: 'error', message: 'Create a site first.' });
      return;
    }

    await runSubmit(async () => {
      await submitMeteorMethod('floorMaps.create', {
        siteId: selectedSiteId,
        name: floorMapForm.name.trim(),
        imageUrl: floorMapForm.imageUrl.trim(),
      });
      setFloorMapForm({ name: '', imageUrl: '' });
    });
  }

  async function handleCreateStorageUnit(event) {
    event.preventDefault();
    if (!selectedFloorMapId) {
      setStatus({ type: 'error', message: 'Create a floor map first.' });
      return;
    }

    await runSubmit(async () => {
      if (!hasValidUnitPosition(unitForm) || Number(unitForm.width) < 1 || Number(unitForm.height) < 1) {
        throw new Error('Position values must be numbers, and width/height must be at least 1.');
      }

      await submitMeteorMethod('storageUnits.create', {
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
      setStatus({ type: 'error', message: 'Create a storage unit first.' });
      return;
    }

    await runSubmit(async () => {
      await submitMeteorMethod('storageLocations.create', {
        storageUnitId: selectedStorageUnitId,
        name: locationForm.name.trim(),
        code: locationForm.code.trim(),
      });
      setLocationForm(DEFAULT_LOCATION_FORM);
    });
  }

  return (
    <div className="min-h-full bg-zinc-100">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Locations</h1>
            <p className="text-sm text-zinc-600">
              Minimal management UI for testing the Site → Floor Map → Storage Unit → Storage
              Location object chain.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm">
            {isLoading ? 'Loading location data…' : `${sites.length} sites loaded`}
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

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Panel title="Site" subtitle="Create and select the top-level physical area.">
              <form className="mb-4 grid gap-3" onSubmit={handleCreateSite}>
                <TextInput
                  label="Name"
                  value={siteForm.name}
                  onChange={(event) =>
                    setSiteForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Warehouse"
                />
                <TextArea
                  label="Description"
                  value={siteForm.description}
                  onChange={(event) =>
                    setSiteForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Optional note about this site"
                />
                <button
                  type="submit"
                  disabled={submitting || !siteForm.name.trim()}
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  Add Site
                </button>
              </form>

              {sites.length ? (
                <div className="grid gap-2">
                  {sites.map((site) => (
                    <button
                      key={site._id}
                      type="button"
                      onClick={() => setSelectedSiteId(site._id)}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        site._id === selectedSiteId
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400'
                      }`}
                    >
                      <div className="font-medium">{site.name}</div>
                      <div
                        className={`text-sm ${
                          site._id === selectedSiteId ? 'text-zinc-300' : 'text-zinc-500'
                        }`}
                      >
                        {site.description || 'No description'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState>No sites yet. Create one to unlock the rest of the chain.</EmptyState>
              )}
            </Panel>

            <Panel
              title="Floor Maps"
              subtitle={
                selectedSite ? `Attached to ${selectedSite.name}.` : 'Select a site first.'
              }
            >
              <form className="mb-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateFloorMap}>
                <TextInput
                  label="Name"
                  value={floorMapForm.name}
                  onChange={(event) =>
                    setFloorMapForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ground Floor"
                />
                <TextInput
                  label="Image URL"
                  value={floorMapForm.imageUrl}
                  onChange={(event) =>
                    setFloorMapForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                  placeholder="https://example.com/floor.png"
                />
                <button
                  type="submit"
                  disabled={submitting || !selectedSiteId || !floorMapForm.name.trim()}
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400 md:col-span-2"
                >
                  Add Floor Map
                </button>
              </form>

              {floorMapsForSite.length ? (
                <div className="grid gap-2">
                  {floorMapsForSite.map((floorMap) => (
                    <button
                      key={floorMap._id}
                      type="button"
                      onClick={() => setSelectedFloorMapId(floorMap._id)}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        floorMap._id === selectedFloorMapId
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400'
                      }`}
                    >
                      <div className="font-medium">{floorMap.name}</div>
                      <div
                        className={`text-sm ${
                          floorMap._id === selectedFloorMapId ? 'text-zinc-300' : 'text-zinc-500'
                        }`}
                      >
                        {floorMap.imageUrl || 'No image URL'}
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
                  : 'Select a floor map first.'
              }
            >
              <form className="mb-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateStorageUnit}>
                <TextInput
                  label="Name"
                  value={unitForm.name}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Shelf A"
                />
                <SelectInput
                  label="Type"
                  value={unitForm.type}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, type: event.target.value }))
                  }
                  options={STORAGE_UNIT_TYPES.map((type) => ({ value: type, label: type }))}
                />
                <NumberInput
                  label="X"
                  value={unitForm.x}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, x: event.target.value }))
                  }
                />
                <NumberInput
                  label="Y"
                  value={unitForm.y}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, y: event.target.value }))
                  }
                />
                <NumberInput
                  label="Width"
                  value={unitForm.width}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, width: event.target.value }))
                  }
                />
                <NumberInput
                  label="Height"
                  value={unitForm.height}
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, height: event.target.value }))
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
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400 md:col-span-2"
                >
                  Add Storage Unit
                </button>
              </form>

              {storageUnitsForFloorMap.length ? (
                <div className="grid gap-2">
                  {storageUnitsForFloorMap.map((unit) => (
                    <button
                      key={unit._id}
                      type="button"
                      onClick={() => setSelectedStorageUnitId(unit._id)}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        unit._id === selectedStorageUnitId
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{unit.name}</span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs uppercase ${
                            unit._id === selectedStorageUnitId
                              ? 'bg-zinc-700 text-zinc-100'
                              : 'bg-zinc-200 text-zinc-700'
                          }`}
                        >
                          {unit.type}
                        </span>
                      </div>
                      <div
                        className={`mt-1 text-sm ${
                          unit._id === selectedStorageUnitId ? 'text-zinc-300' : 'text-zinc-500'
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
                  : 'Select a storage unit first.'
              }
            >
              <form
                className="mb-4 grid gap-3 md:grid-cols-2"
                onSubmit={handleCreateStorageLocation}
              >
                <TextInput
                  label="Name"
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Top Shelf"
                />
                <TextInput
                  label="Code"
                  value={locationForm.code}
                  onChange={(event) =>
                    setLocationForm((current) => ({ ...current, code: event.target.value }))
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
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400 md:col-span-2"
                >
                  Add Storage Location
                </button>
              </form>

              {locationsForStorageUnit.length ? (
                <div className="grid gap-2">
                  {locationsForStorageUnit.map((location) => (
                    <div
                      key={location._id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
                    >
                      <div className="font-medium text-zinc-900">{location.name}</div>
                      <div className="text-sm text-zinc-500">{location.code}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>No storage locations on this unit yet.</EmptyState>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel
              title="Relationship Summary"
              subtitle="Quick sanity check of what is currently selected."
            >
              <dl className="grid gap-3 text-sm">
                <div className="rounded-lg bg-zinc-50 px-4 py-3">
                  <dt className="font-medium text-zinc-500">Site</dt>
                  <dd className="text-zinc-950">{selectedSite?.name || 'None selected'}</dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-4 py-3">
                  <dt className="font-medium text-zinc-500">Floor Map</dt>
                  <dd className="text-zinc-950">{selectedFloorMap?.name || 'None selected'}</dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-4 py-3">
                  <dt className="font-medium text-zinc-500">Storage Unit</dt>
                  <dd className="text-zinc-950">
                    {selectedStorageUnit?.name || 'None selected'}
                  </dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-4 py-3">
                  <dt className="font-medium text-zinc-500">Storage Locations</dt>
                  <dd className="text-zinc-950">{locationsForStorageUnit.length}</dd>
                </div>
              </dl>
            </Panel>

            <Panel
              title="Floor Map Preview"
              subtitle="Simple visual check for storage-unit position values."
            >
              <div className="rounded-xl border border-dashed border-zinc-300 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:24px_24px] p-4">
                <div className="relative h-[420px] overflow-hidden rounded-lg bg-white">
                  {storageUnitsForFloorMap.map((unit) => (
                    <button
                      key={unit._id}
                      type="button"
                      onClick={() => setSelectedStorageUnitId(unit._id)}
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
                      Add a storage unit to see it plotted here.
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
