/**
 * Pure helpers for the barcode/QR feature.
 * Codes are DERIVED at render time, never stored:
 *  - product barcode value = sku (if set) or the product _id
 *  - storage unit QR = URL to that unit's detail page
 */

/** Value encoded in a product's Code-128 barcode. */
export function getBarcodeValue(product) {
  if (!product) return "";
  const sku = typeof product.sku === "string" ? product.sku.trim() : "";
  return sku || product._id || "";
}

/** URL encoded in a storage unit's QR code. */
export function buildUnitQrUrl(origin, unitId) {
  return `${origin}/locations/unit/${unitId}`;
}

/**
 * If `text` is a URL on our own origin, return its path (for in-app
 * navigation). Anything else — foreign URL or plain text — returns null.
 * Used by the scanner: URL → navigate, plain text → product code lookup.
 */
export function parseScannedUrl(text, origin) {
  if (typeof text !== "string" || !text.startsWith("http")) return null;
  try {
    const url = new URL(text);
    if (url.origin !== origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

export function generateSku() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return "SKU-" + rand;
}
