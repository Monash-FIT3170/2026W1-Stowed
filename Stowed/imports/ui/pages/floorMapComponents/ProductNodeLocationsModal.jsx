import { useState } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { StorageLocations, StorageUnits } from "/imports/api/locations/collections";
import { modalStyles, productNodeModalStyles } from "./FloorMapStyles";

/**
 * Asks which of a storage unit's locations (e.g. shelves) can be reached from a product node.
 * Shown when a product node is placed, and when an existing product node is clicked.
 * At least one location must be chosen.
 *
 * @param {{ storageUnitId: string, storageLocationIds?: string[] }} node - The product node
 * @param {boolean}                   isNew     - The node was just placed (cancelling removes it)
 * @param {(ids: string[]) => void}   onConfirm - Called with the chosen storage location ids
 * @param {() => void}                onCancel
 *
 * @returns {JSX.Element} Modal UI
 */
export function ProductNodeLocationsModal({ node, isNew, onConfirm, onCancel }) {
  const { unit, locations } = useTracker(
    () => ({
      unit: StorageUnits.findOne(node.storageUnitId),
      locations: StorageLocations.find(
        { storageUnitId: node.storageUnitId },
        { sort: { code: 1, name: 1 } },
      ).fetch(),
    }),
    [node.storageUnitId],
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set(node.storageLocationIds ?? []));

  function toggleLocation(locationId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  }

  // Only keep ids that still belong to this unit (a location may have been removed since)
  const chosenIds = locations.map((l) => l._id).filter((id) => selectedIds.has(id));
  const canConfirm = chosenIds.length > 0;

  return (
    // BACKDROP
    <div onClick={onCancel} style={modalStyles.overlay}>
      {/* MODAL */}
      <div onClick={(e) => e.stopPropagation()} style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Accessible Storage Locations</h3>
        <p style={modalStyles.helper}>
          Which locations in <strong>{unit?.name ?? "this unit"}</strong> can be reached from this
          product node?
        </p>

        {locations.length === 0 ? (
          <p style={productNodeModalStyles.empty}>
            This storage unit has no storage locations yet. Add some in Edit mode first.
          </p>
        ) : (
          <div style={productNodeModalStyles.list}>
            {locations.map((location) => (
              <label key={location._id} style={productNodeModalStyles.option}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(location._id)}
                  onChange={() => toggleLocation(location._id)}
                />
                <span style={productNodeModalStyles.optionCode}>{location.code || "-"}</span>
                <span style={productNodeModalStyles.optionName}>{location.name}</span>
              </label>
            ))}
          </div>
        )}

        {/* ACTIONS */}
        <div style={modalStyles.actions}>
          <button type="button" style={modalStyles.buttonSecondary} onClick={onCancel}>
            {isNew ? "Cancel placement" : "Cancel"}
          </button>
          <button
            type="button"
            style={productNodeModalStyles.confirmButton(canConfirm)}
            disabled={!canConfirm}
            onClick={() => onConfirm(chosenIds)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
