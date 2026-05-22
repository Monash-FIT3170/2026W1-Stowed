import { useState } from "react";
import { modalStyles, storagePanelStyles } from "./FloorMapStyles";
import { UnitCard } from "./UnitCard";

// --- CONSTANTS ---
// width & height set in meters
const PRESET_UNITS = [
  { type: "shelf", name: "Shelf", width: 2, height: 1, fill: "lightblue" },
];
const EMPTY_FORM = { name: "", width: 1, height: 1, fill: "white" };

/**
 * Panel component for displaying and creating storage unit templates
 * 
 * @param {(unit: {name: string, width: number, height: number, fill: string, type?: string}) => void} OnSelectUnit 
 *        - Callback triggered when a unit is selected  
 * 
 * @returns {JSX.Element} Storage Panel UI
 */
export function StoragePanel({ onSelectUnit }) {
    const [customUnits, setCustomUnits] = useState([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [showForm, setShowForm] = useState(false);

    function handleFormChange(e) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value}));
    }

  function handleCreateUnit() {
    // no name, don't create unit
    if (!form.name.trim()) return;
    // create and set
    const newUnit = {
      ...form,
      type: "custom",
      width: Number(form.width),
      height: Number(form.height),
    };
    setCustomUnits((prev) => [...prev, newUnit]);
    // reset form
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  return (
    <div style={storagePanelStyles.panel}>
      <p style={storagePanelStyles.sectionTitle}>Presets</p>

      {/* add all preset units */}
      {PRESET_UNITS.map((unit) => (
        <UnitCard
          key={unit.type}
          unit={unit}
          onClick={() => onSelectUnit(unit)}
        />
      ))}

      {/* add all custom units*/}
      {customUnits.length > 0 && (
        <>
          <p style={storagePanelStyles.sectionTitle}>Custom</p>
          {customUnits.map((unit, i) => (
            <UnitCard key={i} unit={unit} onClick={() => onSelectUnit(unit)} />
          ))}
        </>
      )}

      {/* allow for creation of storage units */}
      <button
        style={storagePanelStyles.createBtn}
        onClick={() => setShowForm(true)}
      >
        + Create Unit
      </button>

      {/* storage unit creation form */}
      {showForm && (
        <div onClick={handleCancel} style={modalStyles.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={modalStyles.modal}>
            <h3 style={modalStyles.title}>Create Unit</h3>

            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Name</label>
              <input
                style={modalStyles.input}
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="e.g. Rack A"
              />
            </div>

            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Width (m)</label>
              <input
                style={modalStyles.input}
                name="width"
                type="number"
                value={form.width}
                onChange={handleFormChange}
                min={50}
              />
            </div>

            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Height (m)</label>
              <input
                style={modalStyles.input}
                name="height"
                type="number"
                value={form.height}
                onChange={handleFormChange}
                min={50}
              />
            </div>

            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Colour</label>
              <input
                style={{ ...modalStyles.input, padding: 2, height: 36 }}
                name="fill"
                type="color"
                value={form.fill}
                onChange={handleFormChange}
              />
            </div>

            <div style={modalStyles.actions}>
              <button
                onClick={handleCancel}
                style={modalStyles.buttonSecondary}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUnit}
                style={modalStyles.buttonPrimary}
              >
                Save Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
