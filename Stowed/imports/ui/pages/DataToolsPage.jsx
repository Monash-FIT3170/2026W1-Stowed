import "../Global.css";
import "./DataToolsPage.css";
import { useState, useRef } from "react";
import { Meteor } from "meteor/meteor";

const JSON_TEMPLATE_ROWS = [
  {
    siteName: "",
    floorMapName: "",
    floorMapWidth: "",
    floorMapHeight: "",
    storageUnitName: "",
    storageUnitType: "",
    storageUnitOffsetX: "",
    storageUnitOffsetY: "",
    storageUnitWidth: "",
    storageUnitHeight: "",
    locationName: "",
    locationCode: "",
    lastStocktakeAt: "",
    name: "",
    description: "",
    category: "",
    sku: "",
    brand: "",
    unitCost: "",
    totalQuantity: "",
    assignments: [
      {
        locationCode: "",
        quantity: "",
      },
    ],
    reorderAt: "",
    qrCode: "",
  },
];

const JSON_SAMPLE_ROWS = [
  {
    siteName: "Main Warehouse",
    floorMapName: "Ground Floor",
    floorMapWidth: 12,
    floorMapHeight: 8,
    storageUnitName: "Shelf A",
    storageUnitType: "shelf",
    storageUnitOffsetX: 1,
    storageUnitOffsetY: 1,
    storageUnitWidth: 2,
    storageUnitHeight: 1,
    locationName: "Bin A1",
    locationCode: "A1",
    lastStocktakeAt: "2026-08-23T00:00:00.000Z",
    name: "Nitrile Gloves",
    description: "Powder-free disposable gloves",
    category: "Safety",
    sku: "GLV-001",
    brand: "Ansell",
    unitCost: 12.5,
    totalQuantity: 24,
    assignments: [
      {
        locationCode: "A1",
        quantity: 24,
      },
    ],
    reorderAt: 10,
    qrCode: "GLV-001-A1",
  },
  {
    siteName: "Main Warehouse",
    floorMapName: "Ground Floor",
    floorMapWidth: 12,
    floorMapHeight: 8,
    storageUnitName: "Cabinet B",
    storageUnitType: "cabinet",
    storageUnitOffsetX: 4,
    storageUnitOffsetY: 1,
    storageUnitWidth: 2,
    storageUnitHeight: 2,
    locationName: "Drawer B2",
    locationCode: "B2",
    lastStocktakeAt: "2026-08-23T00:00:00.000Z",
    name: "Masking Tape",
    description: "General-purpose masking tape",
    category: "Consumables",
    sku: "TAPE-002",
    brand: "3M",
    unitCost: 4.75,
    totalQuantity: 12,
    assignments: [
      {
        locationCode: "B2",
        quantity: 12,
      },
    ],
    reorderAt: 4,
    qrCode: "TAPE-002-B2",
  },
];

function downloadFile({ content, type, filename }) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  downloadFile({
    content: JSON.stringify(JSON_TEMPLATE_ROWS, null, 2),
    type: "application/json",
    filename: "data-template.json",
  });
}

function downloadSample() {
  downloadFile({
    content: JSON.stringify(JSON_SAMPLE_ROWS, null, 2),
    type: "application/json",
    filename: "data-sample.json",
  });
}

export function DataToolsPage() {
  const [combinedFile, setCombinedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    setStatus("Starting import...");

    try {
      if (!combinedFile) {
        setStatus("No file selected to import");
        return;
      }

      setStatus("Uploading combined file...");
      const text = await combinedFile.text();
      const result = await new Promise((res, rej) => {
        Meteor.call("bulk.importCombined", text, (err, result) => {
          if (err) rej(err);
          else res(result);
        });
      });

      const skipped = result?.skippedDuplicateProducts || 0;
      const skippedMessage = skipped ? ` Skipped ${skipped} duplicate product${skipped === 1 ? "" : "s"}.` : "";
      setStatus(`Import complete. Created ${result?.createdProducts || 0} product${result?.createdProducts === 1 ? "" : "s"} and ${result?.createdLocations || 0} location${result?.createdLocations === 1 ? "" : "s"}.${skippedMessage}`);
    } catch (err) {
      console.error(err);
      setStatus(`Import failed: ${err.message || err}`);
    }
  };

  return (
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

      <div className="data-tools-wrap">
        <div className="bulk-import-wrapper">
          <div className="tools-card bulk-card">
            <div className="bulk-import-hero">
              <h2>Bulk Data Import</h2>
            </div>

            <div className="templates-row">
              <button className="btn-primary" onClick={() => downloadTemplate()}>Download JSON template</button>
              <button className="btn-secondary" onClick={() => downloadSample()}>Download sample JSON</button>
            </div>

            <div className="upload-row">
              <div className="file-input">
                <input
                  ref={fileInputRef}
                  className="file-input-hidden"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => setCombinedFile(e.target.files?.[0] ?? null)}
                />

                <button
                  className="btn-secondary file-chooser-button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  Choose JSON
                </button>

                <div className="file-name">{combinedFile ? combinedFile.name : "No file chosen"}</div>
              </div>

              <div>
                <button className="btn-primary" onClick={handleUpload} disabled={!combinedFile}>Import</button>
                <div className="import-status">{status}</div>
              </div>
            </div>
          </div>

          <aside className="actions-panel import-actions">
            <div className="panel-card">
              <h4>Status</h4>
              <div className="status-box">{status || "No import in progress"}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default DataToolsPage;
