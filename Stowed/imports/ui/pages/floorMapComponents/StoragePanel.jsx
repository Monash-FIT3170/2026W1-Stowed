import { useEffect, useState } from "react";
import { storagePanelStyles } from "./FloorMapStyles";
import { UnitCard } from "./UnitCard";

// --- CONSTANTS ---
// width & height set in meters
const PRESET_UNITS = [
  { type: "shelf", name: "Shelf", width: 2, height: 1, fill: "#d6ede8" },
];
const EMPTY_FORM = { name: "", width: 1, height: 1, fill: "#d6ede8" };
const CUSTOM_UNITS_STORAGE_KEY = "stowed.customStorageUnitTemplates";

/**
 * Panel component for displaying and creating storage unit templates
 * 
 * @param {(unit: {name: string, width: number, height: number, fill: string, type?: string}) => void} OnSelectUnit 
 *        - Callback triggered when a unit is selected  
 * 
 * @returns {JSX.Element} Storage Panel UI
 */
export function StoragePanel({ onSelectUnit }) {
  const [customUnits, setCustomUnits] = useState(() => {
    try {
      if (typeof window === "undefined") return [];
      const savedUnits = window.localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
      const parsedUnits = savedUnits ? JSON.parse(savedUnits) : [];
      return Array.isArray(parsedUnits) ? parsedUnits : [];
    } catch (error) {
      return [];
    }
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(customUnits));
    } catch (error) {
      // Custom templates are a convenience; storage failures should not block editing.
    }
  }, [customUnits]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleCreateUnit() {
    const width = Number(form.width);
    const height = Number(form.height);

    if (!form.name.trim() || width <= 0 || height <= 0) return;

    const newUnit = {
      ...form,
      name: form.name.trim(),
      type: "custom",
      width,
      height,
    };

    setCustomUnits((prev) => [...prev, newUnit]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  return (
    <div style={storagePanelStyles.panel}>
      <p style={storagePanelStyles.sectionTitle}>Presets</p>

      {PRESET_UNITS.map((unit) => (
        <UnitCard
          key={unit.type}
          unit={unit}
          onClick={() => onSelectUnit(unit)}
        />
      ))}

      {customUnits.length > 0 && (
        <>
          <p style={storagePanelStyles.sectionTitle}>Custom</p>
          {customUnits.map((unit, i) => (
            <UnitCard
              key={`${unit.name}-${i}`}
              unit={unit}
              onClick={() => onSelectUnit(unit)}
            />
          ))}
        </>
      )}

      <button
        type="button"
        style={storagePanelStyles.createBtn}
        onClick={() => setShowForm((v) => !v)}
      >
        {showForm ? "Cancel" : "+ Create Unit"}
      </button>

      {showForm && (
        <div style={storagePanelStyles.form}>
          <label style={storagePanelStyles.label} htmlFor="storage-unit-name">Name</label>
          <input
            id="storage-unit-name"
            style={storagePanelStyles.input}
            name="name"
            value={form.name}
            onChange={handleFormChange}
            placeholder="e.g. Rack A"
          />

          <label style={storagePanelStyles.label} htmlFor="storage-unit-width">Width (m)</label>
          <input
            id="storage-unit-width"
            style={storagePanelStyles.input}
            name="width"
            type="number"
            value={form.width}
            onChange={handleFormChange}
            min={0.5}
            step={0.5}
          />

          <label style={storagePanelStyles.label} htmlFor="storage-unit-height">Height (m)</label>
          <input
            id="storage-unit-height"
            style={storagePanelStyles.input}
            name="height"
            type="number"
            value={form.height}
            onChange={handleFormChange}
            min={0.5}
            step={0.5}
          />

          <label style={storagePanelStyles.label} htmlFor="storage-unit-fill">Colour</label>
          <input
            id="storage-unit-fill"
            style={{ ...storagePanelStyles.input, padding: 2, height: 36 }}
            name="fill"
            type="color"
            value={form.fill}
            onChange={handleFormChange}
          />

          <button
            type="button"
            style={storagePanelStyles.saveBtn}
            onClick={handleCreateUnit}
          >
            Save Unit
          </button>
        </div>
      )}
    </div>
  );
}
