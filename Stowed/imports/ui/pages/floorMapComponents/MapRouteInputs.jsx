
import { useState } from "react";

export function MapRouteInputs({
  products = [],
  productsReady = false,
  selectedProductIds = [],
  onAddProduct,
  onRemoveProduct,
  startingPoint = null,
  isSelectingStart = false,
  onSelectStart,
  onClearStart,
  mapReady = false,
}) {
  const [showScanPlaceholder, setShowScanPlaceholder] = useState(false);

  const selectedIds = new Set(selectedProductIds);
  const availableProducts = products.filter(
    (product) => !selectedIds.has(product._id)
  );

  const productLabel = (product) => {
    const name = product.name || product.sku || product._id;
    return product.name && product.sku
      ? `${name} (${product.sku})`
      : name;
  };

  const productPlaceholder = !productsReady
    ? "Loading products..."
    : products.length === 0
      ? "No products available"
      : availableProducts.length === 0
        ? "All products added"
        : "Select a product";

  const startCoordinates = startingPoint
    ? `X: ${startingPoint.x.toFixed(2)} m, Y: ${startingPoint.y.toFixed(2)} m`
    : "No starting point selected";

  return (
    <section className="map-route-compact" aria-label="Route planning inputs">

      {/* PRODUCTS */}
      <div className="map-route-compact__field">
        <div className="map-route-compact__label-row">
          <label htmlFor="map-route-products">Products</label>
          <span>{selectedProductIds.length} selected</span>
        </div>

        <select
          id="map-route-products"
          className="form-input"
          value=""
          disabled={!productsReady || availableProducts.length === 0}
          onChange={(event) => {
            if (event.target.value) onAddProduct(event.target.value);
          }}
        >
          <option value="" disabled>
            {productPlaceholder}
          </option>

          {availableProducts.map((product) => (
            <option key={product._id} value={product._id}>
              {productLabel(product)}
            </option>
          ))}
        </select>

        {selectedProductIds.length > 0 && (
          <ul className="map-route-compact__products">
            {selectedProductIds.map((productId) => {
              const product = products.find(
                (entry) => entry._id === productId
              );
              const label = product ? productLabel(product) : productId;

              return (
                <li key={productId} className="map-route-compact__product">
                  <span>{label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => onRemoveProduct(productId)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* STARTING POINT */}
      <div className="map-route-compact__field">
        <label>Starting Point</label>

        <div className="map-route-compact__start">
          <span className="map-route-compact__coordinates">
            {startCoordinates}
          </span>

          <button
            type="button"
            className="map-route-compact__button"
            disabled={!mapReady}
            aria-pressed={isSelectingStart}
            onClick={onSelectStart}
          >
            {startingPoint ? "Change" : "Select"}
          </button>
        </div>
      </div>

      {/* GENERATE ROUTE */}
      <div className="map-route-compact__generate-route-section">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {}}
        >
          Generate Route
        </button>

      </div>

      {/* SCAN PRODUCTS */}
      <div className="map-route-compact__scan-section">
        <button
          type="button"
          className="btn-secondary"
          aria-expanded={showScanPlaceholder}
          onClick={() => setShowScanPlaceholder((previous) => !previous)}
        >
          Scan Products
        </button>

        {showScanPlaceholder && (
          <p className="map-route-compact__hint">
            Camera scanning is not available yet.
          </p>
        )}
      </div>

    </section>
  );
}
