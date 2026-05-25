import { useState } from "react";
import { modalStyles } from "./FloorMapStyles";
import { CANVAS_CONFIG } from "./canvas/CanvasConfig";


/**
 * Modal overlay for editing canvas and grid config.
 * 
 * @param {{ width: number, height: number }} floorSize - Current floor dimensions in pixels
 * @param {number} gridInterval - Current grid cell size in meters
 * @param {boolean} showGrid - Whether the grid is visible
 * @param {boolean} snapToGrid - Whether units snap to the grid on drop/drag
 * @param {(config: { floorSize, gridInterval, showGrid, snapToGrid }) => void} onSave - Commit callback
 * @param {() => void} onClose - Cancel / close callback
 * 
 * @returns {JSX.Element} Modal UI
 */
export function CanvasSettingsModal({ floorSize, gridInterval, showGrid, snapToGrid, onSave, onClose }) {
  const toMeters = (px) => {
    const m = Number(px) / CANVAS_CONFIG.PIXELS_PER_METER;
    return (m > 0 && isFinite(m)) ? m : 10;
  };

  const [draft, setDraft] = useState({
    widthMeters:  toMeters(floorSize.width),
    heightMeters: toMeters(floorSize.height),
    gridInterval: gridInterval > 0 ? gridInterval : 1,
    showGrid,
    snapToGrid,
  });

  // generic field updater
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setDraft(prev => ({...prev, [name]: type === "checkbox" ? checked : Number(value)}));
  }

  function handleSave() {
    // validate dimensions before committing
    if (draft.widthMeters  <= 0) return;
    if (draft.heightMeters <= 0) return;
    if (draft.gridInterval <= 0) return;

    onSave({
      // convert meters back to pixels for floorSize
      floorSize: {
        width:  draft.widthMeters  * CANVAS_CONFIG.PIXELS_PER_METER,
        height: draft.heightMeters * CANVAS_CONFIG.PIXELS_PER_METER,
      },
      gridInterval: draft.gridInterval,
      showGrid:     draft.showGrid,
      snapToGrid:   draft.snapToGrid,
    });

    onClose();
  }
  return (
    // BACKDROP
    <div onClick={onClose} style={modalStyles.overlay}>
  
      {/* MODAL */}
      <div onClick={(e) => e.stopPropagation()} style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Canvas Settings</h3>
  
        {/* FLOOR DIMENSIONS */}
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Floor Width (m)</label>
          <input style={modalStyles.input} type="number" name="widthMeters" min={1} value={draft.widthMeters} onChange={handleChange}/>
        </div>
  
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Floor Height (m)</label>
          <input style={modalStyles.input} type="number" name="heightMeters" min={1} value={draft.heightMeters} onChange={handleChange}/>
        </div>
  
        {/* GRID INTERVAL */}
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Grid Interval (m)</label>
          <input style={modalStyles.input} type="number" name="gridInterval" min={0.5} step={0.5} value={draft.gridInterval} onChange={handleChange}/>
        </div>
  
        {/* TOGGLES */}
        <div style={modalStyles.checkboxRow}>
          <label>
            <input type="checkbox" name="showGrid" checked={draft.showGrid} onChange={handleChange}
            />
            {" "}Show Grid
          </label>
        </div>
  
        <div style={modalStyles.checkboxRow}>
          <label>
            <input type="checkbox" name="snapToGrid" checked={draft.snapToGrid} onChange={handleChange}
            />
            {" "}Snap to Grid
          </label>
        </div>
  
        {/* ACTIONS */}
        <div style={modalStyles.actions}>
          <button onClick={onClose} style={modalStyles.buttonSecondary}>Cancel</button>
          <button onClick={handleSave} style={modalStyles.buttonPrimary}>Save</button>
        </div>
      </div>
    </div>
  );
}