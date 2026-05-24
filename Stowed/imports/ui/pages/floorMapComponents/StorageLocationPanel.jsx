import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { locationPanelStyles } from "./FloorMapStyles";

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
        await Meteor.callAsync("storageLocations.delete", {
            storageLocationId,
        });

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={locationPanelStyles.input}
        />

        <input
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={locationPanelStyles.input}
        />

        <button
          onClick={handleAddLocation}
          style={locationPanelStyles.addButton}
        >
          + Add Location
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
              onClick={() => handleDeleteLocation(location._id)}
              style={locationPanelStyles.deleteButton}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}