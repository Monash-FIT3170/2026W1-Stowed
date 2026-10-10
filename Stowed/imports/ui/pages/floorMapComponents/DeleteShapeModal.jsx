import { useState } from "react";
import { useTracker } from "meteor/react-meteor-data";

import { FloorMaps, StorageUnits, MapShapes } from "/imports/api/locations/collections";
import { modalStyles, COLOURS } from "./FloorMapStyles";

export function DeleteShapeModal({ shape, onConfirm, onClose }) {
  const [choices, setChoices] = useState({});
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { units, replacements } = useTracker(() => {
    const floorMapNameById = new Map(FloorMaps.find().map((f) => [f._id, f.name]));

    return {
      units: StorageUnits.find({ "shape.shapeId": shape.shapeId }, { sort: { name: 1 } })
        .fetch()
        .map((unit) => ({
          ...unit,
          floorName: floorMapNameById.get(unit.floorMapId) || "Unknown",
        })),
      replacements: MapShapes.find(
        { shapeId: { $ne: shape.shapeId } },
        { sort: { name: 1 } },
      ).fetch(),
    };
  }, [shape.shapeId]);

  const canConfirm = units.every((unit) => choices[unit._id]) && !isSubmitting;

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(
        units.map((unit) => ({
          storageUnitId: unit._id,
          targetShapeId: Number(choices[unit._id]),
        })),
      );
    } catch (err) {
      setError(err.reason || "Failed to delete this shape.");
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={modalStyles.overlay}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...modalStyles.modal, width: "420px", maxHeight: "80vh", overflowY: "auto" }}
      >
        <h3 style={modalStyles.title}>Delete &quot;{shape.name}&quot;</h3>

        <div style={{ fontSize: "11px", color: COLOURS.TEXT_MUTED }}>
          This shape is used by {units.length} storage unit{units.length === 1 ? "" : "s"}. Choose a
          replacement shape for each one before the shape is deleted.
        </div>

        {replacements.length === 0 ? (
          <div style={{ fontSize: "11px", color: COLOURS.TEXT_PRIMARY, fontWeight: 600 }}>
            There are no other shapes to switch these units to. Create another shape first.
          </div>
        ) : (
          units.map((unit) => (
            <div key={unit._id} style={modalStyles.field}>
              <label style={modalStyles.label}>
                {unit.name} ({unit.floorName})
              </label>
              <select
                style={modalStyles.input}
                value={choices[unit._id] || ""}
                onChange={(e) => setChoices((prev) => ({ ...prev, [unit._id]: e.target.value }))}
              >
                <option value="" disabled>
                  Change to...
                </option>
                {replacements.map((replacement) => (
                  <option key={replacement.shapeId} value={replacement.shapeId}>
                    {replacement.name}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}

        {error && <div style={{ fontSize: "11px", color: "#b3261e" }}>{error}</div>}

        <div style={modalStyles.actions}>
          <button onClick={onClose} style={modalStyles.buttonSecondary}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || replacements.length === 0}
            style={{
              ...modalStyles.buttonPrimary,
              opacity: canConfirm && replacements.length > 0 ? 1 : 0.5,
            }}
          >
            Change &amp; Delete
          </button>
        </div>
      </div>
    </div>
  );
}
