import { useState } from "react";
import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products } from "../../api/products/collections";
import { StorageUnits, FloorMaps } from "../../api/locations/collections";
import { getBarcodeValue } from "/imports/api/products/codes";
import { ProductBarcode } from "../components/ProductBarcode";
import { LocationQRCode } from "../components/LocationQRCode";
import "../Global.css";
import "./QRCodesPage.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error)
        else resolve(result)
    });
  });
}

function hasCode(product) {
  return !!(product.sku && product.sku.trim())
}

function hasUnitCode(unit) {
  return !!unit.qrGenerated
}

/**
 * Codes hub: every product's Code-128 barcode and every storage unit's QR.
 * Product rows filter by category; each row links to its detail page where
 * the printable label lives. Styled with the existing Bloom classes.
 */
export function QRCodesPage() {
  const [tab, setTab] = useState("products");
  const [category, setCategory] = useState("all");
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [unitBulkMode, setUnitBulkMode] = useState(false)
  const [selectedUnitIds, setSelectedUnitIds] = useState([])
  const [unitGenerating, setUnitGenerating] = useState(false)

  const { loading, products, units, floorMaps } = useTracker(() => {
    // Meteor.subscribe only exists on the client; static/server renders
    // (e.g. the pageRendering tests) just show the loading state.
    if (!Meteor.isClient) {
      return { loading: true, products: [], units: [], floorMaps: [] };
    }
    const subProducts = Meteor.subscribe("products");
    const subLocations = Meteor.subscribe("locations.all");
    return {
      loading: !subProducts.ready() || !subLocations.ready(),
      products: Products.find({}, { sort: { name: 1 } }).fetch(),
      units: StorageUnits.find({}, { sort: { name: 1 } }).fetch(),
      floorMaps: FloorMaps.find().fetch(),
    };
  }, []);

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const visibleProducts =
    category === "all" ? products : products.filter((p) => p.category === category);
  const floorMapName = (unit) => floorMaps.find((f) => f._id === unit.floorMapId)?.name || "";

  const codelessProducts = products.filter((p) => !hasCode(p))
  const codelessUnits = units.filter((u) => !hasUnitCode(u))

  function toggleSelected(id) {
    if (selectedIds.includes(id))
      setSelectedIds(selectedIds.filter((x) => x !== id))
    else
    setSelectedIds([...selectedIds, id])
  }

  function selectAllCodeless() {
    setSelectedIds(codelessProducts.map((p) => p._id))
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError('')
    try {
      await callMethod("products.bulkGenerateCodes", { productIds: selectedIds })
      setSelectedIds([])
      setBulkMode(false)
    } catch (err) {
      setGenerateError(err.reason || err.message || 'Failed to generate codes.')
    }
    setGenerating(false)
  }

  function toggleSelectedUnit(id) {
    if (selectedUnitIds.includes(id))
      setSelectedUnitIds(selectedUnitIds.filter((x) => x !== id))
    else
    setSelectedUnitIds([...selectedUnitIds, id])
  }

  function selectAllCodelessUnits() {
    setSelectedUnitIds(codelessUnits.map((u) => u._id))
  }

  async function handleGenerateUnits() {
    setUnitGenerating(true)
    try {
      await callMethod("storageUnits.bulkGenerateCodes", { unitIds: selectedUnitIds })
      setSelectedUnitIds([])
      setUnitBulkMode(false)
    } catch (err) {
      console.log('bulk generate failed', err)
    }
    setUnitGenerating(false)
  }

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    padding: "14px 20px",
    borderBottom: "0.5px solid var(--border-light)",
  };

  const emptyStyle = { padding: "32px", textAlign: "center", color: "var(--text-muted)" };

  return (
    <div className="product-detail-container">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Tools</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">QR Codes</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">
            QR <em>Codes</em>
          </h1>
          {/* Desktop scan entry point (mobile has the dock's centre button) */}
          <Link to="/scan" className="btn-primary" style={{ textDecoration: "none" }}>
            [ ] Scan
          </Link>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
          Product barcodes open the product&apos;s page when scanned; storage unit QR codes open
          the unit&apos;s page. Print labels from each detail page, or scan with the button above.
        </p>
      </div>

      <div style={{ padding: "16px 28px 48px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <button
            className={tab === "products" ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab("products")}
          >
            Product barcodes
          </button>
          <button
            className={tab === "units" ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab("units")}
          >
            Storage unit QR codes
          </button>

          {tab === "products" && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
              {!bulkMode && (
                <select
                  className="form-input"
                  style={{ width: "auto" }}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories ({products.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <button
                className={bulkMode ? "bulk-generate-toggle active" : "bulk-generate-toggle"}
                onClick={() => setBulkMode(!bulkMode)}
              >
                {bulkMode ? "‹ Back to codes" : `Select products to generate codes (${codelessProducts.length})`}
              </button>
            </div>
          )}
          {tab === "units" && (
            <button onClick={() => setUnitBulkMode(!unitBulkMode)}>
              {unitBulkMode ? "Cancel bulk generate" : "Bulk generate"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="detail-section">
            <div style={emptyStyle}>Loading…</div>
          </div>
        ) : tab === "products" && bulkMode ? (
          <div className="detail-section">
            <div className="bulk-toolbar">
              <span className="bulk-selected-label">
                {selectedIds.length} of {codelessProducts.length} selected
              </span>
              <div className="bulk-toolbar-actions">
                <button className="btn-secondary" onClick={selectAllCodeless}>
                  Select all
                </button>
                <button
                  className="btn-primary"
                  disabled={selectedIds.length === 0 || generating}
                  onClick={handleGenerate}
                >
                  {generating ? "Generating..." : `Generate (${selectedIds.length})`}
                </button>
              </div>
            </div>
            {generateError && <p className="bulk-error">{generateError}</p>}
            {codelessProducts.length === 0 ? (
              <div style={emptyStyle}>Every product already has a code.</div>
            ) : (
              codelessProducts.map((product) => {
                const checked = selectedIds.includes(product._id)
                return (
                  <label
                    key={product._id}
                    className={checked ? "code-row selected" : "code-row"}
                  >
                    <input
                      type="checkbox"
                      className="code-row-checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(product._id)}
                      aria-label={`Select ${product.name}`}
                    />
                    <div style={{ minWidth: 0 }}>
                      <strong>{product.name}</strong>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {product.category ? `${product.category} · ` : ""}
                        No code assigned
                      </div>
                    </div>
                  </label>
                )
              })
            )}
          </div>
        ) : tab === "products" ? (
          <div className="detail-section">
            {visibleProducts.length === 0 ? (
              <div style={emptyStyle}>No products in this category.</div>
            ) : (
              visibleProducts.map((product) => (
                <div key={product._id} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/inventory/${product._id}`} className="item-name-link">
                      <strong>{product.name}</strong>
                    </Link>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {product.category ? `${product.category} · ` : ""}
                      {product.sku ? `SKU: ${product.sku}` : `ID: ${product._id}`}
                    </div>
                  </div>
                  <ProductBarcode value={getBarcodeValue(product)} height={40} />
                </div>
              ))
            )}
          </div>
        ) : tab === "units" && unitBulkMode ? (
          <div className="detail-section">
            <div>
              <button onClick={selectAllCodelessUnits}>Select all</button>
              <button
                disabled={selectedUnitIds.length === 0 || unitGenerating}
                onClick={handleGenerateUnits}
              >
                {unitGenerating ? "Generating..." : `Generate (${selectedUnitIds.length})`}
              </button>
            </div>
            {codelessUnits.length === 0 ? (
              <div>Every storage unit already has a code.</div>
            ) : (
              codelessUnits.map((unit) => (
                <div key={unit._id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedUnitIds.includes(unit._id)}
                      onChange={() => toggleSelectedUnit(unit._id)}
                    />
                    {unit.name}
                  </label>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="detail-section">
            {units.length === 0 ? (
              <div style={emptyStyle}>No storage units yet.</div>
            ) : (
              units.map((unit) => (
                <div key={unit._id} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/locations/unit/${unit._id}`} className="item-name-link">
                      <strong>{unit.name}</strong>
                    </Link>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {unit.type}
                      {floorMapName(unit) ? ` · ${floorMapName(unit)}` : ""}
                    </div>
                  </div>
                  <LocationQRCode unitId={unit._id} size={72} alt={unit.name} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
