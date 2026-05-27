import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { storagePanelStyles } from "./FloorMapStyles";
import { useEditor } from "./canvas/editor/EditorContext";
import { CANVAS_CONFIG } from "./canvas/CanvasConfig";

const TYPE_OPTIONS = [
  { value: "shelf",   label: "Shelf" },
  { value: "cabinet", label: "Cabinet" },
  { value: "rack",    label: "Rack" },
  { value: "other",   label: "Other" },
];

const TYPE_COLOURS = {
  shelf:   "#d6ede8",
  cabinet: "#dde8f5",
  rack:    "#f5ece0",
  other:   "#e8e8e8",
};

const EMPTY_FORM = { name: "", type: "shelf", width: "2", height: "1" };

/**
 * Scan the floor in 0.5 m steps (top-left → bottom-right) to find the first
 * position where a unit of `unitW × unitH` metres does not overlap any existing
 * unit.  Returns `{ x, y }` in metres, or `null` if the floor is full.
 */
function findFreePosition(unitW, unitH, existingUnits, floorW, floorH) {
  const STEP = 0.5;
  for (let y = 0; y + unitH <= floorH + 0.001; y += STEP) {
    for (let x = 0; x + unitW <= floorW + 0.001; x += STEP) {
      const overlaps = existingUnits.some(
        (u) =>
          x          < u.x + u.width  &&
          x + unitW  > u.x            &&
          y          < u.y + u.height &&
          y + unitH  > u.y
      );
      if (!overlaps) return { x, y };
    }
  }
  return null;
}

/**
 * Sidebar panel for adding new storage units directly to the database.
 * Automatically places the unit at the first free position on the floor.
 *
 * @param {{ floorMapId: string }} props
 */
export function StoragePanel({ floorMapId }) {
  const { units, floorSize } = useEditor();

  const [form, setForm]           = useState(EMPTY_FORM);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const unitW   = Number(form.width);
  const unitH   = Number(form.height);
  const floorWm = (floorSize.width  || 500) / CANVAS_CONFIG.PIXELS_PER_METER;
  const floorHm = (floorSize.height || 500) / CANVAS_CONFIG.PIXELS_PER_METER;

  const isValid =
    form.name.trim().length > 0 &&
    !isNaN(unitW) && unitW >= 0.5 &&
    !isNaN(unitH) && unitH >= 0.5;

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  function handleToggle() {
    setShowForm((v) => !v);
    setError("");
    setSuccess("");
  }

  async function handleCreate() {
    if (!isValid || !floorMapId || submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    const freePos = findFreePosition(unitW, unitH, units, floorWm, floorHm);
    if (!freePos) {
      setError(
        `No free space for a ${unitW} × ${unitH} m unit. ` +
        "Try a smaller size or move existing units first."
      );
      setSubmitting(false);
      return;
    }

    try {
      await Meteor.callAsync("storageUnits.create", {
        floorMapId,
        name:     form.name.trim(),
        type:     form.type,
        position: { x: freePos.x, y: freePos.y, width: unitW, height: unitH },
        fill:     TYPE_COLOURS[form.type] ?? "#d6ede8",
      });
      setSuccess(
        `"${form.name.trim()}" added at ` +
        `(${freePos.x.toFixed(1)} m, ${freePos.y.toFixed(1)} m) - drag to reposition.`
      );
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err.reason || "Failed to create storage unit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* Success banner */}
      {success && (
        <div style={{
          fontSize: 11, color: "#166534", background: "#dcfce7",
          border: "1px solid #86efac", borderRadius: 8,
          padding: "8px 10px",
        }}>
          {success}
        </div>
      )}

      {/* Toggle button */}
      <button
        type="button"
        style={storagePanelStyles.createBtn}
        onClick={handleToggle}
      >
        {showForm ? "Cancel" : "+ Add Storage Unit"}
      </button>

      {/* Inline form */}
      {showForm && (
        <div style={storagePanelStyles.form}>

          {/* Name */}
          <label style={storagePanelStyles.label} htmlFor="su-name">
            Name <span style={{ color: "#d86f58" }}>*</span>
          </label>
          <input
            id="su-name"
            style={storagePanelStyles.input}
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Rack A"
            autoComplete="off"
          />

          {/* Type */}
          <label style={storagePanelStyles.label} htmlFor="su-type">
            Type <span style={{ color: "#d86f58" }}>*</span>
          </label>
          <select
            id="su-type"
            style={{ ...storagePanelStyles.input, cursor: "pointer" }}
            name="type"
            value={form.type}
            onChange={handleChange}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Width + Height side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <label style={storagePanelStyles.label} htmlFor="su-width">
                Width (m) <span style={{ color: "#d86f58" }}>*</span>
              </label>
              <input
                id="su-width"
                style={storagePanelStyles.input}
                name="width"
                type="number"
                min="0.5"
                step="0.5"
                value={form.width}
                onChange={handleChange}
              />
            </div>
            <div>
              <label style={storagePanelStyles.label} htmlFor="su-height">
                Depth (m) <span style={{ color: "#d86f58" }}>*</span>
              </label>
              <input
                id="su-height"
                style={storagePanelStyles.input}
                name="height"
                type="number"
                min="0.5"
                step="0.5"
                value={form.height}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Floor space preview */}
          {isValid && (
            <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0", fontStyle: "italic" }}>
              {unitW} × {unitH} m on a {floorWm} × {floorHm} m floor
            </p>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize: 11, color: "#d86f58", margin: 0 }}>{error}</p>
          )}

          {/* Submit */}
          <button
            type="button"
            style={{
              ...storagePanelStyles.saveBtn,
              opacity: isValid && !submitting ? 1 : 0.45,
              cursor:  isValid && !submitting ? "pointer" : "not-allowed",
            }}
            disabled={!isValid || submitting || !floorMapId}
            onClick={handleCreate}
          >
            {submitting ? "Creating..." : "Create Storage Unit"}
          </button>

        </div>
      )}
    </div>
  );
}
