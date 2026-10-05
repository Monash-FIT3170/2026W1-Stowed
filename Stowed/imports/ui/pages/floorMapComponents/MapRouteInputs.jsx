import { useState } from "react";
import { buttonStyles } from "./FloorMapStyles";

export function MapRouteInputs({
  products = [],
  productsReady = false,
  selectedProductIds = [],
  onAddProduct,
  onRemoveProduct,
  startingPoint = null,
  isSelectingStart = false,
  onSelectStart,
  onCancelSelectStart,
  onClearStart,
  mapReady = false,
}) {
  const [showScanPlaceholder, setShowScanPlaceholder] = useState(false);
  const selectedIds = new Set(selectedProductIds);
  const availableProducts = products.filter((product) => !selectedIds.has(product._id));
  const productLabel = (product) => {
    const name = product.name || product.sku || product._id;
    return product.name && product.sku ? `${name} (${product.sku})` : name;
  };
  const productPlaceholder = !productsReady
    ? "Loading products…"
    : products.length === 0
      ? "No products available"
      : availableProducts.length === 0
        ? "All products added"
        : "Choose a product to add";
  const startCoordinates = startingPoint
    ? `X: ${startingPoint.x.toFixed(2)} m, Y: ${startingPoint.y.toFixed(2)} m`
    : null;

  return (
    <section className="map-route-inputs" aria-label="Route planning inputs">
      <div className="map-route-inputs__fields">
        <div className="map-route-inputs__field">
          <label htmlFor="map-route-products">Products</label>
          <select
            id="map-route-products"
            className="form-input"
            value=""
            disabled={!productsReady || availableProducts.length === 0}
            aria-describedby="map-route-products-status"
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
          <p id="map-route-products-status" className="map-route-inputs__hint" role="status">
            {!productsReady
              ? "Loading your product list."
              : products.length === 0
                ? "Add products to your inventory to choose them here."
                : selectedProductIds.length === 0
                  ? "Choose items one at a time to add them to your route."
                  : `${selectedProductIds.length} ${selectedProductIds.length === 1 ? "product" : "products"} added.`}
          </p>
          {selectedProductIds.length > 0 && (
            <ul className="map-route-inputs__products" aria-label="Selected products">
              {selectedProductIds.map((productId) => {
                const product = products.find((entry) => entry._id === productId);
                const label = product ? productLabel(product) : productId;
                return (
                  <li key={productId} className="map-route-inputs__product">
                    <span>{label}</span>
                    <button
                      type="button"
                      className="map-route-inputs__remove"
                      aria-label={`Remove ${label}`}
                      onClick={() => onRemoveProduct(productId)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="map-route-inputs__field">
          <label htmlFor="map-route-select-start">Starting point</label>
          <div className="map-route-inputs__start-actions">
            <button
              id="map-route-select-start"
              type="button"
              className="map-route-inputs__button"
              style={{
                ...buttonStyles.base,
                ...(isSelectingStart ? buttonStyles.active : {}),
                ...(!mapReady ? buttonStyles.disabled : {}),
              }}
              disabled={!mapReady}
              aria-pressed={isSelectingStart}
              aria-describedby="map-route-start-status"
              onClick={onSelectStart}
            >
              {startingPoint ? "Change starting point" : "Select on map"}
            </button>
            {isSelectingStart && (
              <button
                type="button"
                className="map-route-inputs__text-button"
                onClick={onCancelSelectStart}
              >
                Cancel
              </button>
            )}
            {startingPoint && (
              <button
                type="button"
                className="map-route-inputs__text-button"
                onClick={onClearStart}
              >
                Clear
              </button>
            )}
          </div>
          <p id="map-route-start-status" className="map-route-inputs__hint" role="status">
            {!mapReady
              ? "Set up a floor map to choose a starting point."
              : isSelectingStart
                ? "Click a point on the floor map to set your starting point. Press Escape to cancel."
                : startingPoint
                  ? "Starting point selected on the floor map."
                  : "Choose Select on map, then click a point on the floor map."}
            {startCoordinates && (
              <span className="map-route-inputs__coordinates">{startCoordinates}</span>
            )}
          </p>
        </div>

        <button
          type="button"
          className="map-route-inputs__scan-button"
          style={buttonStyles.base}
          aria-expanded={showScanPlaceholder}
          aria-controls="map-route-scan-placeholder"
          onClick={() => setShowScanPlaceholder((previous) => !previous)}
        >
          Scan products
        </button>
      </div>

      <div
        id="map-route-scan-placeholder"
        className="map-route-inputs__scan"
        hidden={!showScanPlaceholder}
      >
        Product scanner placeholder — camera scanning is not available yet.
      </div>
    </section>
  );
}
