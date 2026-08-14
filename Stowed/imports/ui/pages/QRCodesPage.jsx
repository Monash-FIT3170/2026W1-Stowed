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

/**
 * Codes hub: every product's Code-128 barcode and every storage unit's QR.
 * Product rows filter by category; each row links to its detail page where
 * the printable label lives.
 */
export function QRCodesPage() {
  const [tab, setTab] = useState("products");
  const [category, setCategory] = useState("all");

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
        </div>
      </div>
      
      <div style={{ padding: "0 28px 48px" }}>
        <p>
          Product barcodes open the product page when scanned, storage unit QR codes open
          the unit's page.
        </p>

        {loading && <p>Loading…</p>}

        {!loading && (
          <>
            <div>
              <button
                type="button"
                disabled={tab === "products"}
                onClick={() => setTab("products")}
              >
                Product barcodes
              </button>{" "}
              <button type="button" disabled={tab === "units"} onClick={() => setTab("units")}>
                Storage unit QR codes
              </button>
            </div>

            {tab === "products" && (
              <>
                <p>
                  <label htmlFor="category-filter">Category: </label>
                  <select
                    id="category-filter"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="all">All ({products.length})</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </p>

                {visibleProducts.length === 0 ? (
                  <p>No products in this category.</p>
                ) : (
                  <table border="1" cellPadding="8">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Code</th>
                        <th>Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((product) => (
                        <tr key={product._id}>
                          <td>
                            <Link to={`/inventory/${product._id}`}>{product.name}</Link>
                          </td>
                          <td>{product.category || "—"}</td>
                          <td>{product.sku ? `SKU ${product.sku}` : `ID ${product._id}`}</td>
                          <td>
                            <ProductBarcode value={getBarcodeValue(product)} height={40} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {tab === "units" &&
              (units.length === 0 ? (
                <p>No storage units yet.</p>
              ) : (
                <table border="1" cellPadding="8">
                  <thead>
                    <tr>
                      <th>Storage unit</th>
                      <th>Type</th>
                      <th>Floor map</th>
                      <th>QR code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => (
                      <tr key={unit._id}>
                        <td>
                          <Link to={`/locations/unit/${unit._id}`}>{unit.name}</Link>
                        </td>
                        <td>{unit.type}</td>
                        <td>{floorMapName(unit) || "—"}</td>
                        <td>
                          <LocationQRCode unitId={unit._id} size={72} alt={unit.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
