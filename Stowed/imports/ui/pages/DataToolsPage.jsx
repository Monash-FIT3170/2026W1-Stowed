import "../Global.css";
import "./DataToolsPage.css";
import { useState, useRef } from "react";
import { Meteor } from "meteor/meteor";

function makeCsvTemplate() {
  // Single combined template: header only (no example rows)
  return "siteName,floorMapName,storageUnitName,storageUnitType,locationName,locationCode,name,description,category,brand,unitCost,totalQuantity,assignments";
}

function downloadTemplate() {
  const csv = makeCsvTemplate();
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `combined-import-template.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

      setStatus("Uploading combined CSV...");
      const text = await combinedFile.text();
      await new Promise((res, rej) => {
        Meteor.call("bulk.importCombined", text, (err, result) => {
          if (err) rej(err);
          else res(result);
        });
      });

      setStatus("Import complete.");
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
              <p className="small-muted">Use the combined CSV template to import your inventory and storage layout in a single file. Download the template, fill it out, then upload it to import everything at once.</p>
            </div>

            <div className="templates-row">
              <button className="btn-primary" onClick={() => downloadTemplate()}>Download import template</button>
            </div>

            <div className="upload-row">
              <div className="file-input">
                <input
                  ref={fileInputRef}
                  className="file-input-hidden"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCombinedFile(e.target.files?.[0] ?? null)}
                />

                <button
                  className="btn-secondary file-chooser-button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  Choose CSV
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
