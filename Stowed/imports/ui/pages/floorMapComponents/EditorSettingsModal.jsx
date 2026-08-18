import { useState } from "react";
import { modalStyles } from "./FloorMapStyles";

/**
 * Modal overlay for editing canvas editor preferences (grid display and snapping),
 * as opposed to floor map properties like its dimensions - see FloorMapSettingsModal.
 *
 * @param {number} gridInterval - Current grid cell size in meters
 * @param {boolean} showGrid - Whether the grid is visible
 * @param {boolean} snapToGrid - Whether units snap to the grid on drop/drag
 * @param {(config: { gridInterval, showGrid, snapToGrid }) => void} onSave - Commit callback
 * @param {() => void} onClose - Cancel / close callback
 *
 * @returns {JSX.Element} Modal UI
 */
export function EditorSettingsModal({ gridInterval, showGrid, snapToGrid, onSave, onClose }) {
  const [draft, setDraft] = useState({
    gridInterval: gridInterval > 0 ? gridInterval : 1,
    showGrid,
    snapToGrid,
  });

  // generic field updater
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setDraft((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : Number(value),
    }));
  }

  function handleSave() {
    if (draft.gridInterval <= 0) return;

    onSave({
      gridInterval: draft.gridInterval,
      showGrid: draft.showGrid,
      snapToGrid: draft.snapToGrid,
    });

    onClose();
  }

  return (
    // BACKDROP
    <div onClick={onClose} style={modalStyles.overlay}>
      {/* MODAL */}
      <div onClick={(e) => e.stopPropagation()} style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Editor Settings</h3>

        {/* GRID INTERVAL */}
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Grid Interval (m)</label>
          <input
            style={modalStyles.input}
            type="number"
            name="gridInterval"
            min={0.5}
            step={0.5}
            value={draft.gridInterval}
            onChange={handleChange}
          />
        </div>

        {/* TOGGLES */}
        <div style={modalStyles.checkboxRow}>
          <label>
            <input
              type="checkbox"
              name="showGrid"
              checked={draft.showGrid}
              onChange={handleChange}
            />{" "}
            Show Grid
          </label>
        </div>

        <div style={modalStyles.checkboxRow}>
          <label>
            <input
              type="checkbox"
              name="snapToGrid"
              checked={draft.snapToGrid}
              onChange={handleChange}
            />{" "}
            Snap to Grid
          </label>
        </div>

        {/* ACTIONS */}
        <div style={modalStyles.actions}>
          <button onClick={onClose} style={modalStyles.buttonSecondary}>
            Cancel
          </button>
          <button onClick={handleSave} style={modalStyles.buttonPrimary}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
