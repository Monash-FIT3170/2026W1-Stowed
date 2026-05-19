import { useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { useNavigate } from 'react-router-dom';

import { FloorMaps, Sites } from '/imports/api/locations/collections';

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

function Panel({ title, subtitle, children, actions }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
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

function TextArea(props) {
  return (
    <textarea
      {...props}
      className="min-h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
    />
  );
}

function SectionButton({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
        active
          ? 'border-zinc-950 bg-zinc-950 text-white'
          : 'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
      {children}
    </div>
  );
}

export function LocationsPage() {
  const navigate = useNavigate();
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedFloorMapId, setSelectedFloorMapId] = useState('');
  const [siteForm, setSiteForm] = useState({ name: '', description: '' });
  const [floorMapForm, setFloorMapForm] = useState({ name: '', imageUrl: '' });
  const [editingSiteId, setEditingSiteId] = useState('');
  const [editingFloorMapId, setEditingFloorMapId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const { isLoading, sites, floorMaps } = useTracker(() => {
    const handle = Meteor.subscribe('locations.all');

    return {
      isLoading: !handle.ready(),
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
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

  useEffect(() => {
    if (!sites.length) {
      setSelectedSiteId('');
      return;
    }

    if (!sites.some((site) => site._id === selectedSiteId)) {
      setSelectedSiteId(sites[0]._id);
    }
  }, [selectedSiteId, sites]);

  useEffect(() => {
    if (!floorMapsForSite.length) {
      setSelectedFloorMapId('');
      return;
    }

    if (!floorMapsForSite.some((floorMap) => floorMap._id === selectedFloorMapId)) {
      setSelectedFloorMapId(floorMapsForSite[0]._id);
    }
  }, [floorMapsForSite, selectedFloorMapId]);

  function resetSiteForm() {
    setSiteForm({ name: '', description: '' });
    setEditingSiteId('');
  }

  function resetFloorMapForm() {
    setFloorMapForm({ name: '', imageUrl: '' });
    setEditingFloorMapId('');
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

  async function handleSiteSubmit(event) {
    event.preventDefault();

    await runAction(async () => {
      const payload = {
        name: siteForm.name.trim(),
        description: siteForm.description.trim(),
      };

      if (editingSiteId) {
        await callMethod('sites.update', { siteId: editingSiteId, ...payload });
      } else {
        await callMethod('sites.create', payload);
      }

      resetSiteForm();
    }, editingSiteId ? 'Site updated.' : 'Site created.');
  }

  async function handleFloorMapSubmit(event) {
    event.preventDefault();

    if (!selectedSiteId) {
      setStatus({ type: 'error', message: 'Create a site first.' });
      return;
    }

    await runAction(async () => {
      const payload = {
        siteId: selectedSiteId,
        name: floorMapForm.name.trim(),
        imageUrl: floorMapForm.imageUrl.trim(),
      };

      if (editingFloorMapId) {
        await callMethod('floorMaps.update', { floorMapId: editingFloorMapId, ...payload });
      } else {
        await callMethod('floorMaps.create', payload);
      }

      resetFloorMapForm();
    }, editingFloorMapId ? 'Floor map updated.' : 'Floor map created.');
  }

  async function handleDeleteSite() {
    if (!selectedSite || !window.confirm(`Delete site "${selectedSite.name}"?`)) {
      return;
    }

    await runAction(async () => {
      await callMethod('sites.delete', { siteId: selectedSite._id });
      resetSiteForm();
    }, 'Site deleted.');
  }

  async function handleDeleteFloorMap() {
    if (!selectedFloorMap || !window.confirm(`Delete floor map "${selectedFloorMap.name}"?`)) {
      return;
    }

    await runAction(async () => {
      await callMethod('floorMaps.delete', { floorMapId: selectedFloorMap._id });
      resetFloorMapForm();
    }, 'Floor map deleted.');
  }

  function startEditingSite() {
    if (!selectedSite) return;

    setEditingSiteId(selectedSite._id);
    setSiteForm({
      name: selectedSite.name,
      description: selectedSite.description || '',
    });
  }

  function startEditingFloorMap() {
    if (!selectedFloorMap) return;

    setEditingFloorMapId(selectedFloorMap._id);
    setFloorMapForm({
      name: selectedFloorMap.name,
      imageUrl: selectedFloorMap.imageUrl || '',
    });
  }

  return (
    <div className="min-h-full bg-zinc-100">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Locations Setup</h1>
            <p className="text-sm text-zinc-600">
              Keep this page focused on sites and floor maps. Storage units and storage locations
              are managed from the floor-map workspace.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500">
            {isLoading ? 'Loading…' : `${sites.length} sites · ${floorMaps.length} floor maps`}
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

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Sites" subtitle="Select a site, then manage its floor maps.">
            <form className="mb-4 grid gap-3" onSubmit={handleSiteSubmit}>
              <Field label="Name">
                <TextInput
                  value={siteForm.name}
                  onChange={(event) =>
                    setSiteForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Warehouse"
                />
              </Field>
              <Field label="Description">
                <TextArea
                  value={siteForm.description}
                  onChange={(event) =>
                    setSiteForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Optional note"
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={submitting || !siteForm.name.trim()}
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {editingSiteId ? 'Save Site' : 'Add Site'}
                </button>
                {editingSiteId ? (
                  <button
                    type="button"
                    onClick={resetSiteForm}
                    disabled={submitting}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            {sites.length ? (
              <div className="grid gap-2">
                {sites.map((site) => (
                  <SectionButton
                    key={site._id}
                    type="button"
                    active={site._id === selectedSiteId}
                    onClick={() => setSelectedSiteId(site._id)}
                  >
                    <div className="font-medium">{site.name}</div>
                    <div className={site._id === selectedSiteId ? 'text-sm text-zinc-300' : 'text-sm text-zinc-500'}>
                      {site.description || 'No description'}
                    </div>
                  </SectionButton>
                ))}
              </div>
            ) : (
              <EmptyState>Create a site to begin setting up your storage structure.</EmptyState>
            )}

            {selectedSite ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startEditingSite}
                  disabled={submitting}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                >
                  Edit Selected Site
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSite}
                  disabled={submitting}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700"
                >
                  Delete Selected Site
                </button>
              </div>
            ) : null}
          </Panel>

          <Panel
            title="Floor Maps"
            subtitle={selectedSite ? `Attached to ${selectedSite.name}.` : 'Select a site first.'}
            actions={
              selectedFloorMap ? (
                <button
                  type="button"
                  onClick={() => navigate(`/floor-map/${selectedFloorMap._id}`)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
                >
                  Open Workspace
                </button>
              ) : null
            }
          >
            <form className="mb-4 grid gap-3" onSubmit={handleFloorMapSubmit}>
              <Field label="Name">
                <TextInput
                  value={floorMapForm.name}
                  onChange={(event) =>
                    setFloorMapForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ground Floor"
                />
              </Field>
              <Field label="Image URL">
                <TextInput
                  value={floorMapForm.imageUrl}
                  onChange={(event) =>
                    setFloorMapForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                  placeholder="https://example.com/floor-map.png"
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={submitting || !selectedSiteId || !floorMapForm.name.trim()}
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {editingFloorMapId ? 'Save Floor Map' : 'Add Floor Map'}
                </button>
                {editingFloorMapId ? (
                  <button
                    type="button"
                    onClick={resetFloorMapForm}
                    disabled={submitting}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            {floorMapsForSite.length ? (
              <div className="grid gap-2">
                {floorMapsForSite.map((floorMap) => (
                  <SectionButton
                    key={floorMap._id}
                    type="button"
                    active={floorMap._id === selectedFloorMapId}
                    onClick={() => setSelectedFloorMapId(floorMap._id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{floorMap.name}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          floorMap._id === selectedFloorMapId
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        Workspace
                      </span>
                    </div>
                    <div
                      className={
                        floorMap._id === selectedFloorMapId ? 'text-sm text-zinc-300' : 'text-sm text-zinc-500'
                      }
                    >
                      {floorMap.imageUrl || 'No image URL'}
                    </div>
                  </SectionButton>
                ))}
              </div>
            ) : (
              <EmptyState>No floor maps for this site yet.</EmptyState>
            )}

            {selectedFloorMap ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startEditingFloorMap}
                  disabled={submitting}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                >
                  Edit Selected Floor Map
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/floor-map/${selectedFloorMap._id}`)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                >
                  Manage Units
                </button>
                <button
                  type="button"
                  onClick={handleDeleteFloorMap}
                  disabled={submitting}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700"
                >
                  Delete Selected Floor Map
                </button>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
