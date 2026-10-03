import { useState } from "react";
import { useTracker } from "meteor/react-meteor-data";

import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "/imports/api/locations/collections";
import { modalStyles, COLOURS } from "./FloorMapStyles";

/**
 * Modal shown when deleting a storage unit that still holds storage locations.
 * Each location must be given a destination storage unit before the delete can proceed.
 *
 * @param {{ _id: string, name: string }} unit - The storage unit being deleted
 * @param {string[]} excludedUnitIds - Unit ids that cannot receive locations
 * @param {(assignments: { storageLocationId: string, targetUnitId: string }[]) => Promise<void>} onConfirm
 * @param {() => void} onClose - Cancel / close callback
 *
 * @returns {JSX.Element} Modal UI
 */
export function DeleteUnitModal({ unit, excludedUnitIds, onConfirm, onClose }) {
  const [choices, setChoices] = useState({});
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { locations, destinations } = useTracker(() => {
    const sites = Sites.find().fetch();
    const floorMaps = FloorMaps.find().fetch();
    const siteNameById = new Map(sites.map((site) => [site._id, site.name]));
    const floorMapById = new Map(floorMaps.map((floorMap) => [floorMap._id, floorMap]));

    const options = StorageUnits.find()
      .fetch()
      .filter((candidate) => candidate._id !== unit._id && !excludedUnitIds.includes(candidate._id))
      .map((candidate) => {
        const floorMap = floorMapById.get(candidate.floorMapId);
        const siteName = siteNameById.get(floorMap?.siteId) || "Unknown site";
        return {
          _id: candidate._id,
          label: `${siteName} / ${floorMap?.name || "Unknown floor map"} / ${candidate.name}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      locations: StorageLocations.find({ storageUnitId: unit._id }, { sort: { name: 1 } }).fetch(),
      destinations: options,
    };
  }, [unit._id, excludedUnitIds.join(",")]);

  const allChosen = locations.every((location) => choices[location._id]);
  const canConfirm = locations.length > 0 && allChosen && !isSubmitting;

  function handleChoose(locationId, targetUnitId) {
    setChoices((prev) => ({ ...prev, [locationId]: targetUnitId }));
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(
        locations.map((location) => ({
          storageLocationId: location._id,
          targetUnitId: choices[location._id],
        })),
      );
    } catch (err) {
      setError(err.reason || "Failed to delete this unit.");
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={modalStyles.overlay}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...modalStyles.modal, width: "420px", maxHeight: "80vh", overflowY: "auto" }}
      >
        <h3 style={modalStyles.title}>Delete &quot;{unit.name}&quot;</h3>

        <div style={{ fontSize: "11px", color: COLOURS.TEXT_MUTED }}>
          This unit has {locations.length} storage location{locations.length === 1 ? "" : "s"}.
          Choose where each one should be moved before the unit is deleted.
        </div>

        {destinations.length === 0 ? (
          <div style={{ fontSize: "11px", color: COLOURS.TEXT_PRIMARY, fontWeight: 600 }}>
            There are no other saved storage units to move these locations to. Create and save
            another unit first.
          </div>
        ) : (
          locations.map((location) => (
            <div key={location._id} style={modalStyles.field}>
              <label style={modalStyles.label}>
                {location.name}
                {location.code ? ` (${location.code})` : ""}
              </label>
              <select
                style={modalStyles.input}
                value={choices[location._id] || ""}
                onChange={(e) => handleChoose(location._id, e.target.value)}
              >
                <option value="" disabled>
                  Move to...
                </option>
                {destinations.map((destination) => (
                  <option key={destination._id} value={destination._id}>
                    {destination.label}
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
            disabled={!canConfirm || destinations.length === 0}
            style={{
              ...modalStyles.buttonPrimary,
              opacity: canConfirm && destinations.length > 0 ? 1 : 0.5,
            }}
          >
            Move &amp; Delete
          </button>
        </div>
      </div>
    </div>
  );
}
