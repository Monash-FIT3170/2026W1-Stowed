import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { StorageLocations } from "/imports/api/locations/collections";
import { ProductRecords } from "/imports/api/products/collections";
import { locationPanelStyles, modalStyles } from "./FloorMapStyles";

export function StorageLocationPanel({ storageUnitId }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [addError, setAddError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
  const [deleteBlocked, setDeleteBlocked] = useState(""); // non-empty → show error modal
  const [submitting, setSubmitting] = useState(false);

  const { locations, productRecords } = useTracker(() => {
    Meteor.subscribe("locations.all");
    Meteor.subscribe("productRecords");
    return {
      locations: storageUnitId
        ? StorageLocations.find({ storageUnitId }, { sort: { createdAt: 1 } }).fetch()
        : [],
      productRecords: ProductRecords.find().fetch(),
    };
  }, [storageUnitId]);

  function tryDeleteLocation(id, locationName) {
    const hasProducts = productRecords.some((r) => r.locationId === id);
    if (hasProducts) {
      setDeleteBlocked(
        "This location still has products assigned to it. Move or remove all products from this location first."
      );
    } else {
      setDeleteConfirm({ id, name: locationName });
    }
  }

  async function handleAdd() {
    if (!name.trim() || !code.trim() || !storageUnitId) return;
    const duplicate = locations.some(
      (l) => l.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      setAddError("A location with that name already exists in this unit.");
      return;
    }
    setAddError("");
    setSubmitting(true);
    try {
      await Meteor.callAsync("storageLocations.create", {
        storageUnitId,
        name: name.trim(),
        code: code.trim(),
        imageUrl: "",
      });
      setName("");
      setCode("");
    } catch (err) {
      setAddError(err.reason || "Failed to add location.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(loc) {
    setEditingId(loc._id);
    setEditName(loc.name);
    setEditCode(loc.code || "");
    setAddError("");
  }

  async function saveEdit(loc) {
    const trimmedName = editName.trim();
    const trimmedCode = editCode.trim();
    if (!trimmedName || !trimmedCode) return;
    const duplicate = locations.some(
      (l) => l._id !== loc._id && l.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setAddError("A location with that name already exists in this unit.");
      return;
    }
    setAddError("");
    setSubmitting(true);
    try {
      await Meteor.callAsync("storageLocations.update", {
        storageLocationId: loc._id,
        storageUnitId: loc.storageUnitId,
        name: trimmedName,
        code: trimmedCode,
        imageUrl: loc.imageUrl || "",
      });
      setEditingId(null);
    } catch (err) {
      setAddError(err.reason || "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setSubmitting(true);
    try {
      await Meteor.callAsync("storageLocations.delete", {
        storageLocationId: deleteConfirm.id,
      });
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteConfirm(null);
      setDeleteBlocked(err.reason || "Failed to delete location.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!storageUnitId) {
    return (
      <div style={locationPanelStyles.panel}>
        <p style={locationPanelStyles.title}>Storage Locations</p>
        <p style={locationPanelStyles.helper}>Select a storage unit first.</p>
      </div>
    );
  }

  const canAdd = !submitting && name.trim().length > 0 && code.trim().length > 0;
  const canSaveEdit = !submitting && editName.trim().length > 0 && editCode.trim().length > 0;

  return (
    <>
      <div style={locationPanelStyles.panel}>
        <p style={locationPanelStyles.title}>Storage Locations</p>

        <div style={locationPanelStyles.form}>
          <input
            placeholder="Location name"
            value={name}
            onChange={(e) => { setName(e.target.value); setAddError(""); }}
            style={locationPanelStyles.input}
          />
          <input
            placeholder="Code (e.g. SH-A-01)"
            value={code}
            onChange={(e) => { setCode(e.target.value); setAddError(""); }}
            style={locationPanelStyles.input}
          />
          {addError && (
            <div style={{ fontSize: 11, color: "#d86f58", margin: 0 }}>{addError}</div>
          )}
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            style={{ ...locationPanelStyles.addButton, opacity: canAdd ? 1 : 0.5 }}
          >
            + Add Location
          </button>
        </div>

        <div style={locationPanelStyles.list}>
          {locations.length === 0 && (
            <p style={locationPanelStyles.helper}>No locations yet.</p>
          )}
          {locations.map((location) => (
            <div key={location._id} style={locationPanelStyles.row}>
              {editingId === location._id ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                  <input
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setAddError(""); }}
                    style={locationPanelStyles.input}
                    placeholder="Name"
                  />
                  <input
                    value={editCode}
                    onChange={(e) => { setEditCode(e.target.value); setAddError(""); }}
                    style={locationPanelStyles.input}
                    placeholder="Code"
                  />
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button
                      onClick={() => saveEdit(location)}
                      disabled={!canSaveEdit}
                      style={{
                        ...locationPanelStyles.addButton,
                        flex: 1,
                        background: "#b5532a",
                        color: "white",
                        border: "1px solid #b5532a",
                        opacity: canSaveEdit ? 1 : 0.5,
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setAddError(""); }}
                      style={locationPanelStyles.addButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div style={locationPanelStyles.rowCode}>{location.code}</div>
                    <div style={locationPanelStyles.rowName}>{location.name}</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => startEdit(location)}
                      style={{ ...locationPanelStyles.deleteButton, color: "#998874" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => tryDeleteLocation(location._id, location.name)}
                      style={locationPanelStyles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Blocked error modal */}
      {deleteBlocked && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.modal}>
            <p style={modalStyles.title}>Cannot Delete</p>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>{deleteBlocked}</p>
            <div style={modalStyles.actions}>
              <button style={modalStyles.buttonPrimary} onClick={() => setDeleteBlocked("")}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {deleteConfirm && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.modal}>
            <p style={modalStyles.title}>Delete "{deleteConfirm.name}"?</p>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              This will permanently remove this storage location.
            </p>
            <div style={modalStyles.actions}>
              <button
                style={modalStyles.buttonSecondary}
                onClick={() => setDeleteConfirm(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                style={{
                  ...modalStyles.buttonPrimary,
                  background: "#d86f58",
                  borderColor: "#d86f58",
                  opacity: submitting ? 0.6 : 1,
                }}
                onClick={confirmDelete}
                disabled={submitting}
              >
                {submitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
