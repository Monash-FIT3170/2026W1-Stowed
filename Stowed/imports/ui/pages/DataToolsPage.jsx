import "../Global.css";
import "./DataToolsPage.css";
import { useState, useRef } from "react";
import { Meteor } from "meteor/meteor";

const TEMPLATE_COLUMNS = [
  "siteName",
  "floorMapName",
  "storageUnitName",
  "storageUnitType",
  "locationName",
  "locationCode",
  "name",
  "description",
  "category",
  "sku",
  "brand",
  "unitCost",
  "totalQuantity",
  "assignments",
  "reorderAt",
  "qrCode",
];

function makeCsvTemplate() {
  // Include blank rows so the downloaded CSV opens as a fillable spreadsheet
  // table instead of a single header-only line.
  const blankRow = TEMPLATE_COLUMNS.map(() => "").join(",");
  return [TEMPLATE_COLUMNS.join(","), ...Array.from({ length: 10 }, () => blankRow)].join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeWorksheetXml() {
  const rows = [
    TEMPLATE_COLUMNS,
    ...Array.from({ length: 10 }, () => TEMPLATE_COLUMNS.map(() => "")),
  ];

  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const columnLetter = String.fromCharCode(65 + columnIndex);
          return `<c r="${columnLetter}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function getCrc32(bytes) {
  const table = getCrc32.table || (getCrc32.table = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  }));

  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function makeZip(files) {
  const encoder = new TextEncoder();
  const output = [];
  const centralDirectory = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const crc = getCrc32(contentBytes);
    const localOffset = offset;

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, dosTime);
    writeUint16(output, dosDate);
    writeUint32(output, crc);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...contentBytes);
    offset = output.length;

    const entry = [];
    writeUint32(entry, 0x02014b50);
    writeUint16(entry, 20);
    writeUint16(entry, 20);
    writeUint16(entry, 0);
    writeUint16(entry, 0);
    writeUint16(entry, dosTime);
    writeUint16(entry, dosDate);
    writeUint32(entry, crc);
    writeUint32(entry, contentBytes.length);
    writeUint32(entry, contentBytes.length);
    writeUint16(entry, nameBytes.length);
    writeUint16(entry, 0);
    writeUint16(entry, 0);
    writeUint16(entry, 0);
    writeUint16(entry, 0);
    writeUint32(entry, 0);
    writeUint32(entry, localOffset);
    entry.push(...nameBytes);
    centralDirectory.push(...entry);
  });

  const centralDirectoryOffset = output.length;
  output.push(...centralDirectory);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralDirectoryOffset);
  writeUint16(output, 0);

  return new Uint8Array(output);
}

function makeExcelTemplate() {
  return makeZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Bulk Import Template" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: makeWorksheetXml(),
    },
  ]);
}

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
  const csv = makeCsvTemplate();
  downloadFile({ content: csv, type: "text/csv", filename: "data-template.csv" });
}

function downloadExcelTemplate() {
  downloadFile({
    content: makeExcelTemplate(),
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "data-template.xlsx",
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
              <p className="small-muted">Use the combined data template to import your inventory and storage layout in a single file. The data template headers correspond to database field names — keep the column names as-is when filling the file. Download the data template, fill it out, then upload it to import everything at once.</p>
            </div>

            <div className="templates-row">
              <button className="btn-primary" onClick={() => downloadTemplate()}>Download data template</button>
              <button className="btn-secondary" onClick={() => downloadExcelTemplate()}>Download Excel template</button>
            </div>

            <div className="upload-row">
              <div className="file-input">
                <input
                  ref={fileInputRef}
                  className="file-input-hidden"
                  type="file"
                  accept=".csv,.xls,text/csv,application/vnd.ms-excel"
                  onChange={(e) => setCombinedFile(e.target.files?.[0] ?? null)}
                />

                <button
                  className="btn-secondary file-chooser-button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  Choose CSV or Excel
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
