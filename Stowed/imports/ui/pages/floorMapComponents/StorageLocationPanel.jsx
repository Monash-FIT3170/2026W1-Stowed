import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";

export function StorageLocationPanel({ storageUnitId }) {
    const [locations, setLocations] = useState([]);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");

    async function loadLocations() {
        if (!storageUnitId) return;

        const result = await Meteor.callAsync(
            "storageLocations.getByStorageUnit",
            { storageUnitId }
        );

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
            <div
                style={{
                    padding: "14px 16px",
                    borderRadius: "18px",
                    border: "1px solid #e7d2c2",
                    background: "#fdf7f2",
                }}
            >
                <p style={{ fontWeight: 500, marginBottom: "6px", color: "#8b7b70" }}>
                    Storage Locations
                </p>
                <p style={{ fontSize: "13px", color: "#7e6f65ff" }}>
                    Select a storage unit first.
                </p>
            </div>
        );
    }

    return (
        <div
            style={{
                padding: "14px 16px",
                borderRadius: "18px",
                border: "1px solid #ead8c8",
                background: "#fffaf6",
            }}
        >
            <p
                style={{
                    fontSize: "12px",
                    letterSpacing: "1.5px",
                    color: "#8b7b70",
                    fontWeight: 400,
                    marginBottom: "12px",
                    textTransform: "uppercase",
                }}
            >
                Storage Locations
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                    placeholder="Location name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        border: "1px solid #ead8c8",
                        outline: "none",
                    }}
                />

                <input
                    placeholder="Code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        border: "1px solid #ead8c8",
                        outline: "none",
                    }}
                />

                <button
                    onClick={handleAddLocation}
                    style={{
                        padding: "10px 12px",
                        borderRadius: "999px",
                        border: "1px dashed #d8b8a8",
                        background: "#fff",
                        fontWeight: 400,
                        cursor: "pointer",
                    }}
                >
                    + Add Location
                </button>
            </div>

            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {locations.map((location) => (
                    <div
                        key={location._id}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 12px",
                            borderRadius: "12px",
                            background: "#ffffff",
                            border: "1px solid #ead8c8",
                        }}
                    >
                        <div>
                            <div>{location.code}</div>
                            <div style={{ fontSize: "12px", color: "#7c6f66" }}>
                                {location.name}
                            </div>
                        </div>

                        <button
                            onClick={() => handleDeleteLocation(location._id)}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#b46b5d",
                                fontWeight: 400,
                                cursor: "pointer",
                            }}
                        >
                            Delete
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}