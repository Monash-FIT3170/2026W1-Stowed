import { useState } from "react";
import { modalStyles } from "./FloorMapStyles";
import { CANVAS_CONFIG } from "./canvas/CanvasConfig";

/**
 * Modal overlay for editing floor map properties (currently just its dimensions).
 * In read-only mode the values are shown but cannot be changed or saved.
 *
 * @param {{ width: number, height: number }} floorSize - Current floor dimensions in pixels
 * @param {(config: { floorSize }) => boolean} onSave - Commit callback, returns false to keep the modal open
 * @param {() => void} onClose - Cancel / close callback
 * @param {boolean} [isReadOnly=false] - Show the settings without allowing changes
 * @param {string} [readOnlyMessage] - Explains why the settings can't be changed right now
 *
 * @returns {JSX.Element} Modal UI
 */
export function FloorMapSettingsModal({
  floorSize,
  gridInterval,
  onSave,
  onClose,
  isReadOnly = false,
  readOnlyMessage,
}) {
  const toMeters = (px) => {
    const m = Number(px) / CANVAS_CONFIG.PIXELS_PER_METER;
    return m > 0 && isFinite(m) ? m : 10;
  };

  const [draft, setDraft] = useState({
    widthMeters: toMeters(floorSize.width),
    heightMeters: toMeters(floorSize.height),
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setDraft((prev) => ({ ...prev, [name]: Number(value) }));
  }

  function handleSave() {
    if (draft.widthMeters <= 0 || draft.widthMeters < gridInterval) return;
    if (draft.heightMeters <= 0 || draft.heightMeters < gridInterval) return;

    const saved = onSave({
      floorSize: {
        width: draft.widthMeters * CANVAS_CONFIG.PIXELS_PER_METER,
        height: draft.heightMeters * CANVAS_CONFIG.PIXELS_PER_METER,
      },
    });

    if (saved !== false) onClose();
  }

  return (
    // BACKDROP
    <div onClick={onClose} style={modalStyles.overlay}>
      {/* MODAL */}
      <div onClick={(e) => e.stopPropagation()} style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Floor Map Settings</h3>

        {isReadOnly && <p style={modalStyles.helper}>{readOnlyMessage}</p>}

        {/* FLOOR DIMENSIONS */}
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Floor Width (m)</label>
          <input
            style={modalStyles.input}
            type="number"
            name="widthMeters"
            min={1}
            value={draft.widthMeters}
            onChange={handleChange}
            disabled={isReadOnly}
          />
        </div>

        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Floor Height (m)</label>
          <input
            style={modalStyles.input}
            type="number"
            name="heightMeters"
            min={1}
            value={draft.heightMeters}
            onChange={handleChange}
            disabled={isReadOnly}
          />
        </div>

        {/* ACTIONS */}
        <div style={modalStyles.actions}>
          <button onClick={onClose} style={modalStyles.buttonSecondary}>
            {isReadOnly ? "Close" : "Cancel"}
          </button>
          {!isReadOnly && (
            <button onClick={handleSave} style={modalStyles.buttonPrimary}>
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
