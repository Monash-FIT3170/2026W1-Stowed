import assert from "assert";
import {
  getBarcodeValue,
  buildUnitQrUrl,
  parseScannedUrl,
  generateSku,
} from "../imports/api/products/codes";

describe("barcode/QR helpers", function () {
  describe("getBarcodeValue", function () {
    it("uses the sku when present", function () {
      assert.strictEqual(getBarcodeValue({ _id: "abc123", sku: "GLV-100" }), "GLV-100");
    });

    it("trims the sku", function () {
      assert.strictEqual(getBarcodeValue({ _id: "abc123", sku: "  GLV-100  " }), "GLV-100");
    });

    it("falls back to _id when sku is missing", function () {
      assert.strictEqual(getBarcodeValue({ _id: "abc123" }), "abc123");
    });

    it("falls back to _id when sku is whitespace-only", function () {
      assert.strictEqual(getBarcodeValue({ _id: "abc123", sku: "   " }), "abc123");
    });

    it("returns empty string for missing product", function () {
      assert.strictEqual(getBarcodeValue(null), "");
      assert.strictEqual(getBarcodeValue(undefined), "");
    });
  });

  describe("buildUnitQrUrl", function () {
    it("builds the unit detail URL", function () {
      assert.strictEqual(
        buildUnitQrUrl("https://stowed.example.com", "unit42"),
        "https://stowed.example.com/locations/unit/unit42",
      );
    });
  });

  describe("parseScannedUrl", function () {
    const origin = "https://stowed.example.com";

    it("returns the path for a same-origin URL", function () {
      assert.strictEqual(
        parseScannedUrl("https://stowed.example.com/locations/unit/unit42", origin),
        "/locations/unit/unit42",
      );
    });

    it("keeps the query string", function () {
      assert.strictEqual(
        parseScannedUrl("https://stowed.example.com/inventory/list?filter=low", origin),
        "/inventory/list?filter=low",
      );
    });

    it("rejects foreign-origin URLs", function () {
      assert.strictEqual(
        parseScannedUrl("https://evil.example.com/locations/unit/x", origin),
        null,
      );
    });

    it("rejects plain text (treated as a product code instead)", function () {
      assert.strictEqual(parseScannedUrl("GLV-100", origin), null);
    });

    it("rejects malformed URLs", function () {
      assert.strictEqual(parseScannedUrl("http://", origin), null);
    });

    it("rejects non-string input", function () {
      assert.strictEqual(parseScannedUrl(null, origin), null);
      assert.strictEqual(parseScannedUrl(42, origin), null);
    });
  });

  describe("generateSku", function () {
    it("produces an upper-case SKU- prefixed code", function () {
      const sku = generateSku();
      assert.ok(/^SKU-[0-9A-Z]{1,6}$/.test(sku), `unexpected sku shape: ${sku}`);
      assert.strictEqual(sku, sku.toUpperCase());
    });

    it("is a valid Code-128 value (barcode = sku when set)", function () {
      const product = { _id: "abc123", sku: generateSku() };
      assert.strictEqual(getBarcodeValue(product), product.sku);
    });

    it("practically never collides across many draws", function () {
      const seen = new Set();
      for (let i = 0; i < 2000; i += 1) seen.add(generateSku());
      assert.ok(seen.size > 1990, `only ${seen.size} unique of 2000`);
    });
  });
});
