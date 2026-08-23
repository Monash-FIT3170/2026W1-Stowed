import "../Global.css";
import "./DataToolsPage.css";
import { useMemo, useState, useRef } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { ImportRecords } from "/imports/api/importRecords/collections";

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
    siteName: "North Campus Store",
    floorMapName: "North Main Floor",
    floorMapWidth: 12,
    floorMapHeight: 8,
    storageUnitName: "Cabinet A",
    storageUnitType: "cabinet",
    storageUnitOffsetX: 1,
    storageUnitOffsetY: 1,
    storageUnitWidth: 2,
    storageUnitHeight: 2,
    locationName: "Shelf 1",
    locationCode: "NC-A1",
    lastStocktakeAt: "2026-08-23T00:00:00.000Z",
    name: "Lab Safety Goggles",
    description: "Clear anti-fog safety goggles",
    category: "Safety",
    sku: "SAFE-GOG-001",
    brand: "Uvex",
    unitCost: 11.75,
    totalQuantity: 60,
    assignments: [
      {
        locationCode: "NC-A1",
        quantity: 60,
      },
    ],
    reorderAt: 50,
    qrCode: "QR-NC-A1-GOG",
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

function formatImportDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function DataToolsPage() {
  const [combinedFile, setCombinedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [activeImportAction, setActiveImportAction] = useState(null);
  const { importRecords } = useTracker(() => {
    Meteor.subscribe("importRecords");
    return {
      importRecords: ImportRecords.find({}, { sort: { createdAt: -1 } }).fetch(),
    };
  }, []);
  const latestCompletedImport = useMemo(
    () => importRecords.find((record) => record.status === "completed"),
    [importRecords],
  );

  const importCombinedData = async ({ text, fileName }) => {
    setIsImporting(true);
    setActiveImportAction("import");
    setStatus(`Uploading ${fileName}...`);
    try {
      const result = await new Promise((res, rej) => {
        Meteor.call("bulk.importCombined", { text, fileName }, (err, result) => {
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
    } finally {
      setIsImporting(false);
      setActiveImportAction(null);
    }
  };

  const handleUpload = async () => {
    setStatus("Starting import...");

    try {
      if (!combinedFile) {
        setStatus("No file selected to import");
        return;
      }

      const text = await combinedFile.text();
      await importCombinedData({ text, fileName: combinedFile.name });
    } catch (err) {
      console.error(err);
      setStatus(`Import failed: ${err.message || err}`);
    }
  };

  const handleUndoLatestImport = async () => {
    if (!latestCompletedImport) {
      setStatus("No completed import to undo");
      return;
    }

    setIsUndoing(true);
    setActiveImportAction("undo");
    setStatus(`Undoing ${latestCompletedImport.fileName || "latest import"}...`);

    try {
      const result = await new Promise((res, rej) => {
        Meteor.call("bulk.undoLatestImport", (err, result) => {
          if (err) rej(err);
          else res(result);
        });
      });

      const undone = result?.undone || {};
      setStatus(`Undo complete. Removed ${undone.products || 0} product${undone.products === 1 ? "" : "s"} and ${undone.locations || 0} location${undone.locations === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error(err);
      setStatus(`Undo failed: ${err.message || err}`);
    } finally {
      setIsUndoing(false);
      setActiveImportAction(null);
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
                  disabled={isImporting || isUndoing}
                >
                  Choose JSON
                </button>

                <div className="file-name">{combinedFile ? combinedFile.name : "No file chosen"}</div>
              </div>

              <div>
                <div className="import-buttons">
                  <button className="btn-primary" onClick={handleUpload} disabled={!combinedFile || isImporting || isUndoing}>
                    {activeImportAction === "import" ? "Importing..." : "Import"}
                  </button>
                </div>
                <div className="import-status">{status}</div>
              </div>
            </div>
          </div>

          <aside className="actions-panel import-actions">
            <div className="panel-card">
              <h4>Status</h4>
              <div className="status-box">{status || "No import in progress"}</div>
            </div>
            <div className="panel-card">
              <div className="import-history-header">
                <h4>Import History</h4>
                <button
                  className="btn-secondary"
                  onClick={handleUndoLatestImport}
                  disabled={!latestCompletedImport || isImporting || isUndoing}
                >
                  {activeImportAction === "undo" ? "Undoing..." : "Undo import"}
                </button>
              </div>
              <div className="import-history-list">
                {importRecords.length === 0 ? (
                  <div className="small-muted">No imports yet</div>
                ) : (
                  importRecords.map((record) => {
                    const counts = record.counts || {};
                    return (
                      <div key={record._id} className="import-history-item">
                        <div className="import-history-title">{record.fileName || "Imported data"}</div>
                        <div className="import-history-meta">
                          {formatImportDate(record.createdAt)} · {record.status}
                        </div>
                        <div className="import-history-meta">
                          {counts.createdProducts || 0} products · {counts.createdLocations || 0} locations
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default DataToolsPage;
