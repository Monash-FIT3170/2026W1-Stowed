import { useState } from "react";
import { Meteor } from "meteor/meteor";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

/**
 * Add, rename and delete product categories.
 */
export function ManageCategoriesModal({ categories = [], onClose, onCategoryDeleted }) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action, fallbackMessage) {
    setBusy(true);
    try {
      await action();
      setError("");
    } catch (err) {
      setError(err.reason || err.message || fallbackMessage);
    } finally {
      setBusy(false);
    }
  }

  function handleCreate() {
    const name = newCategoryName.trim();
    if (!name) return;
    return run(async () => {
      await callMethod("productCategories.create", { name });
      setNewCategoryName("");
    }, "Could not add that category. Try a different name.");
  }

  function confirmRename(id) {
    const name = editingName.trim();
    if (!name) return;
    return run(async () => {
      await callMethod("productCategories.rename", { categoryId: id, name });
      setEditingId(null);
      setEditingName("");
    }, "Could not rename that category.");
  }

  function handleDelete(id) {
    return run(async () => {
      await callMethod("productCategories.delete", { categoryId: id });
      onCategoryDeleted?.(id);
    }, "Could not delete that category.");
  }

  function startRename(id, currentName) {
    setEditingId(id);
    setEditingName(currentName);
  }

  function handleClose() {
    setEditingId(null);
    setEditingName("");
    setError("");
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "440px", width: "100%" }}>
        <h3 className="modal-title" style={{ marginBottom: "4px" }}>
          Manage categories
        </h3>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted, #998874)",
            marginBottom: "20px",
          }}
        >
          Add categories staff can pick from when creating a product.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "20px",
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {categories.length === 0 && (
            <p style={{ fontSize: "13px", color: "var(--text-muted, #998874)" }}>
              No categories yet. Add the first one below.
            </p>
          )}

          {categories.map((cat) => (
            <div
              key={cat._id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "var(--card-bg-subtle, #f5efe6)",
              }}
            >
              {editingId === cat._id ? (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename(cat._id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="form-input"
                  style={{ flex: 1 }}
                  autoFocus
                />
              ) : (
                <span style={{ flex: 1, fontSize: "14px" }}>{cat.name}</span>
              )}

              {editingId === cat._id ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => confirmRename(cat._id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => startRename(cat._id, cat.name)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => handleDelete(cat._id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="form-input"
            placeholder="New category name"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreate}
            disabled={busy || !newCategoryName.trim()}
            style={{
              borderRadius: "8px",
              width: "auto",
              padding: "0 20px",
              whiteSpace: "nowrap",
            }}
          >
            + Add
          </button>
        </div>

        {error && (
          <p className="warning-text" style={{ marginTop: "10px" }}>
            {error}
          </p>
        )}

        <div className="modal-actions" style={{ marginTop: "24px" }}>
          <button type="button" className="btn-secondary" disabled={busy} onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
