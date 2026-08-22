import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { toCsv, INVENTORY_COLUMNS, LOCATION_COLUMNS } from "/imports/api/products/export";
import "../Global.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function downloadCsv(filename, csv) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataToolsPage() {
  const { role } = useAuth();
  const canExport = hasClientPermission(role, "products.export");

  const [showExportModal, setShowExportModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [error, setError] = useState("");

  async function openExportModal() {
    setShowExportModal(true);
    setIsLoading(true);
    setError("");
    setExportData(null);
    try {
      const result = await callMethod("products.export", {});
      setExportData(result);
    } catch (err) {
      console.error("Failed to prepare export:", err);
      setError(err.reason || err.message || "Could not prepare the export.");
    } finally {
      setIsLoading(false);
    }
  }

  function closeExportModal() {
    setShowExportModal(false);
    setExportData(null);
    setError("");
  }

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadInventory() {
    downloadCsv(`stowed-inventory-${stamp()}.csv`, toCsv(exportData.inventory, INVENTORY_COLUMNS));
  }

  function downloadLocations() {
    downloadCsv(`stowed-locations-${stamp()}.csv`, toCsv(exportData.locations, LOCATION_COLUMNS));
  }

  return (
    <>
      <div className="product-detail-container">
        <div className="product-detail-header">
          <div className="breadcrumb">
            <span className="breadcrumb-link">Tools</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Data Tools</span>
          </div>
          <div className="header-top">
            <h1 className="header-title">
              <em>Data Tools</em>
            </h1>
          </div>
        </div>

        <div className="product-detail-grid">
          <div className="left-column">
            <div className="detail-section">
              <div className="section-title">
                <span className="section-badge" style={{ background: "#d6ede8", color: "#4a8c78" }}>
                  EX
                </span>
                Bulk export
              </div>
              <div className="section-content">
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
                  Download your full inventory and storage layout as CSV files. Open them in Excel,
                  or use them as templates when importing data from another system.
                </p>
                <button
                  className="btn-primary"
                  onClick={openExportModal}
                  disabled={!canExport}
                  style={{ width: "auto", padding: "0 20px" }}
                >
                  Bulk export
                </button>
                {!canExport && (
                  <p className="warning-text" style={{ marginTop: "10px" }}>
                    You need admin access to export data.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "460px", width: "100%" }}>
            <h3 className="modal-title" style={{ marginBottom: "4px" }}>
              Bulk export
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "20px",
              }}
            >
              Two files, joined by location code. Download both to keep them in step.
            </p>

            {isLoading && <p style={{ fontSize: "13px" }}>Preparing export...</p>}

            {error && <p className="warning-text">{error}</p>}

            {exportData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "var(--card-bg-subtle, #f5efe6)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>Inventory</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {exportData.inventory.length} row
                      {exportData.inventory.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={downloadInventory}>
                    Download
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "var(--card-bg-subtle, #f5efe6)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>Storage layout</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {exportData.locations.length} row
                      {exportData.locations.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={downloadLocations}>
                    Download
                  </button>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="btn-secondary" onClick={closeExportModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
