import assert from "assert";
import {
  extractBase64FromDataUrl,
  getFileExtension,
  isImageFile,
  buildUploadUrl,
} from "../imports/api/upload";

describe("file upload", function () {
  describe("base64 extraction", function () {
    it("returns the data after the comma in a data URL", function () {
      const url = "data:image/png;base64,iVBORw0KGgo=";
      assert.strictEqual(extractBase64FromDataUrl(url), "iVBORw0KGgo=");
    });

    it("works with jpeg data URLs", function () {
      const url = "data:image/jpeg;base64,/9j/4AAQ";
      assert.strictEqual(extractBase64FromDataUrl(url), "/9j/4AAQ");
    });

    it("returns empty string when input is not a data URL", function () {
      assert.strictEqual(extractBase64FromDataUrl("not a url"), "");
      assert.strictEqual(extractBase64FromDataUrl(null), "");
      assert.strictEqual(extractBase64FromDataUrl(undefined), "");
    });
  });

  describe("extension parsing", function () {
    it("extracts a lowercase extension", function () {
      assert.strictEqual(getFileExtension("photo.PNG"), "png");
      assert.strictEqual(getFileExtension("image.jpg"), "jpg");
    });

    it("handles filenames with multiple dots", function () {
      assert.strictEqual(getFileExtension("my.product.photo.jpeg"), "jpeg");
    });

    it("returns empty string when no extension is present", function () {
      assert.strictEqual(getFileExtension("noextension"), "");
      assert.strictEqual(getFileExtension(""), "");
    });
  });

  describe("MIME type validation", function () {
    it("accepts image MIME types", function () {
      assert.ok(isImageFile({ type: "image/png" }));
      assert.ok(isImageFile({ type: "image/jpeg" }));
      assert.ok(isImageFile({ type: "image/gif" }));
      assert.ok(isImageFile({ type: "image/webp" }));
    });

    it("rejects non-image MIME types", function () {
      assert.ok(!isImageFile({ type: "application/pdf" }));
      assert.ok(!isImageFile({ type: "text/plain" }));
      assert.ok(!isImageFile({ type: "video/mp4" }));
    });

    it("rejects null, undefined, or files with no type", function () {
      assert.ok(!isImageFile(null));
      assert.ok(!isImageFile(undefined));
      assert.ok(!isImageFile({}));
      assert.ok(!isImageFile({ type: null }));
    });
  });

  describe("upload URL generation", function () {
    it("places files under /Uploads/images/", function () {
      const url = buildUploadUrl(1234567890, "png");
      assert.ok(url.startsWith("/Uploads/images/"));
    });

    it("uses the timestamp as the filename base", function () {
      const url = buildUploadUrl(1234567890, "png");
      assert.strictEqual(url, "/Uploads/images/1234567890.png");
    });

    it("preserves the extension in the URL", function () {
      assert.ok(buildUploadUrl(1, "png").endsWith(".png"));
      assert.ok(buildUploadUrl(1, "jpg").endsWith(".jpg"));
      assert.ok(buildUploadUrl(1, "webp").endsWith(".webp"));
    });

    it("matches the expected URL pattern", function () {
      const url = buildUploadUrl(Date.now(), "png");
      const pattern = /^\/Uploads\/images\/\d+\.(png|jpg|jpeg|gif|webp)$/;
      assert.ok(pattern.test(url));
    });
  });
});
