
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Meteor } from "meteor/meteor";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { parseScannedUrl } from "/imports/api/products/codes";

export function MapRouteScanModal({
  products,
  selectedProductIds,
  onAddProduct,
  onClose,
}) {
  const [status, setStatus] = useState("Starting camera...");
  const [manualCode, setManualCode] = useState("");
  const [matches, setMatches] = useState([]);

  const handlingRef = useRef(false);
  const cooldownRef = useRef(null);

  // Keep callbacks current without restarting the camera on each render.
  const handleCodeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function addProduct(product) {
    if (selectedProductIds.includes(product._id)) {
      setStatus(`${product.name} is already in the route.`);
      return;
    }

    onAddProduct(product._id);
    setMatches([]);
    setStatus(`Added ${product.name}. Scan another product or click Done.`);
  }

  async function handleCode(text) {
    const code = text.trim();
    if (!code) return;

    setMatches([]);

    // Handle product URLs encoded as QR codes.
    const path = parseScannedUrl(code, window.location.origin);

    if (path) {
      const match = path.match(
        /^\/(?:inventory|scan\/product)\/([^/?#]+)/
      );

      if (!match) {
        setStatus("This QR code does not refer to a product.");
        return;
      }

      const productId = decodeURIComponent(match[1]);
      const product = products.find((p) => p._id === productId);

      if (product) {
        addProduct(product);
      } else {
        setStatus("This product is not available in the route planner.");
      }
      return;
    }

    // Look up a barcode by SKU or product ID, just like ScanPage.
    const result = await Meteor.callAsync("products.findByCode", {
      code,
    });

    // Only allow products available in this route planner.
    const found = (result?.matches || [])
      .map((match) => products.find((p) => p._id === match._id))
      .filter(Boolean);

    if (found.length === 1) {
      addProduct(found[0]);
    } else if (found.length > 1) {
      setMatches(found);
      setStatus(`Multiple products match "${code}". Select one below.`);
    } else {
      setStatus(`No route product matches "${code}".`);
    }
  }

  // Scanner callbacks must use the latest products and selected IDs.
  handleCodeRef.current = handleCode;

  useEffect(() => {
    let cancelled = false;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    const scanner = new Html5Qrcode("map-product-scan-region", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
      ],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });

    const startPromise = scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
      },
      async (decodedText) => {
        if (cancelled || handlingRef.current) return;

        handlingRef.current = true;

        try {
          await handleCodeRef.current(decodedText);
        } catch (error) {
          if (!cancelled) {
            setStatus(error.reason || error.message || "Lookup failed.");
          }
        } finally {
          if (!cancelled) {
            // Prevent the camera scanning the same code every frame.
            cooldownRef.current = setTimeout(() => {
              handlingRef.current = false;
            }, 1500);
          }
        }
      },
    );

    startPromise
      .then(() => {
        if (!cancelled) {
          setStatus("Point the camera at a product barcode or QR code.");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(
            `Camera unavailable: ${error.message || error}. Enter a code below.`
          );
        }
      });

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(cooldownRef.current);

      // Wait for camera startup before stopping, even if modal
      // was closed while camera permission was being requested.
      Promise.resolve(startPromise)
        .catch(() => {})
        .then(async () => {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
          } catch {
            // Scanner may not have started.
          }

          try {
            await scanner.clear();
          } catch {
            // Scanner may already be cleared.
          }
        });
    };
  }, []);

  async function handleManualSubmit(event) {
    event.preventDefault();

    try {
      await handleCode(manualCode);
      setManualCode("");
    } catch (error) {
      setStatus(error.reason || error.message || "Lookup failed.");
    }
  }

  return createPortal(
    <div
      className="map-product-scan-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="map-product-scan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-product-scan-title"
      >
        <div className="map-product-scan-header">
          <h2 id="map-product-scan-title">Scan Products</h2>

          <button
            type="button"
            className="map-product-scan-close"
            onClick={onClose}
            aria-label="Close scanner"
          >
            ×
          </button>
        </div>

        <div
          id="map-product-scan-region"
          className="map-product-scan-camera"
        />

        <p className="map-product-scan-status" role="status">
          {status}
        </p>

        {matches.length > 1 && (
          <div className="map-product-scan-matches">
            {matches.map((product) => (
              <button
                key={product._id}
                type="button"
                className="map-product-scan-match"
                onClick={() => addProduct(product)}
              >
                {product.name}
                {product.sku && ` (${product.sku})`}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleManualSubmit}>
          <label htmlFor="map-product-manual-code">
            No camera? Enter SKU or product ID
          </label>

          <div className="map-product-scan-manual">
            <input
              id="map-product-manual-code"
              className="form-input"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="SKU or product ID"
            />

            <button type="submit" className="btn-primary">
              Add
            </button>
          </div>
        </form>

        <button
          type="button"
          className="btn-secondary map-product-scan-done"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>,
    document.body
  );
}
