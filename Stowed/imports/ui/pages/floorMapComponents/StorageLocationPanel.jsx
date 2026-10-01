import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { locationPanelStyles } from "./FloorMapStyles";
import { FloorMapIcon } from "./FloorMapIcon";

export function StorageLocationPanel({ storageUnitId }) {
  const [locations, setLocations] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  async function loadLocations() {
    if (!storageUnitId) return;

    const result = await Meteor.callAsync("storageLocations.getByStorageUnit", {
      storageUnitId,
    });

    setLocations(result);
  }

  useEffect(() => {
    loadLocations();
  }, [storageUnitId]);

  async function handleAddLocation() {
    if (!name.trim() || !code.trim() || !storageUnitId) return;

    await Meteor.callAsync("storageLocations.create", {
      storageUnitId,
      name,
      code,
      imageUrl: "",
    });

    setName("");
    setCode("");
    loadLocations();
  }

  async function handleDeleteLocation(storageLocationId) {
    try {
      await Meteor.callAsync("storageLocations.delete", {
        storageLocationId,
      });
    } catch (error) {
      alert(
        error.reason ||
          "Storage location is not empty. Please move stock from this storage location before deleting.",
      );
    }

    loadLocations();
  }

  if (!storageUnitId) {
    return (
      <div style={locationPanelStyles.panel}>
        <p style={locationPanelStyles.title}>Storage Locations</p>
        <p style={locationPanelStyles.helper}>Select a storage unit first.</p>
      </div>
    );
  }

  return (
    <div style={locationPanelStyles.panel}>
      <p style={locationPanelStyles.title}>Storage Locations</p>

      <div style={locationPanelStyles.form}>
        <input
          placeholder="Location name"
          aria-label="Location name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={locationPanelStyles.input}
        />

        <input
          placeholder="Code"
          aria-label="Location code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={locationPanelStyles.input}
        />

        <button type="button" onClick={handleAddLocation} style={locationPanelStyles.addButton}>
          <FloorMapIcon name="plus" size={16} />
          <span>Add location</span>
        </button>
      </div>

      <div style={locationPanelStyles.list}>
        {locations.map((location) => (
          <div key={location._id} style={locationPanelStyles.row}>
            <div>
              <div style={locationPanelStyles.rowCode}>{location.code}</div>
              <div style={locationPanelStyles.rowName}>{location.name}</div>
            </div>

            <button
              type="button"
              onClick={() => handleDeleteLocation(location._id)}
              style={locationPanelStyles.deleteButton}
            >
              <FloorMapIcon name="trash" size={16} />
              <span>Delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
