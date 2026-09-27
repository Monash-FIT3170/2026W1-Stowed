import { useState } from "react";
import { buttonStyles } from "./FloorMapStyles";

export function MapRouteInputs() {
  const [products, setProducts] = useState("");
  const [startingPoint, setStartingPoint] = useState("");
  const [showScanPlaceholder, setShowScanPlaceholder] = useState(false);

  return (
    <section className="map-route-inputs" aria-label="Route planning inputs">
      <div className="map-route-inputs__fields">
        <div className="map-route-inputs__field">
          <label htmlFor="map-route-products">Products</label>
          <textarea
            id="map-route-products"
            className="form-input"
            rows={2}
            placeholder="Enter product names or codes, one per line"
            value={products}
            onChange={(event) => setProducts(event.target.value)}
          />
        </div>

        <div className="map-route-inputs__field">
          <label htmlFor="map-route-start">Starting point</label>
          <input
            id="map-route-start"
            className="form-input"
            type="text"
            placeholder="e.g. Main entrance"
            value={startingPoint}
            onChange={(event) => setStartingPoint(event.target.value)}
          />
        </div>

        <button
          type="button"
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