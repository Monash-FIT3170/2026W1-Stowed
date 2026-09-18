import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * Code-128 barcode for a product, rendered into an SVG.
 * `value` should come from getBarcodeValue(product) — sku or _id.
 */
export function ProductBarcode({ value, height = 60, displayValue = true, className }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        displayValue,
        height,
        margin: 0,
        fontSize: 13,
        background: "transparent",
      });
    } catch (err) {
      // Invalid value for CODE128 — leave the SVG empty rather than crash the page.
      console.error("Barcode render failed:", err);
    }
  }, [value, height, displayValue]);

  if (!value) return null;
  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />;
}
