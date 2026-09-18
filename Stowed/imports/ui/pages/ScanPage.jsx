import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { parseScannedUrl } from "/imports/api/products/codes";
import { isPhoneViewport } from "../hooks/deviceDimension";
import "../Global.css";
import "./ScanPage.css";

/**
 * Where a scanned product should open. Checked at navigation time rather than
 * held in state, so the scanner callback never reads a stale value.
 */
function scannedProductRoute(productId) {
  return isPhoneViewport()
    ? `/scan/product/${productId}`
    : `/inventory/${productId}/edit?from=scan`;
}

/**
 * Camera scanner for product barcodes (Code-128) and storage unit QR codes.
 *  - QR with our own URL  -> navigate straight to that page
 *  - anything else        -> products.findByCode (sku, then _id) and navigate
 *
 * Where a product code lands depends on the screen:
 *  - phone (< 768px) -> /scan/product/:id, the quick +/- stocktake screen.
 *                       The full product editing page is not practical here,
 *                       the screen is too small for it.
 *  - tablet and up   -> /inventory/:id/edit, the full product editing page
 *
 * Camera requires a secure context: localhost works in dev, deployments
 * need HTTPS or the camera will not open.
 */
export function ScanPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const handlingRef = useRef(false);
  const [status, setStatus] = useState("Starting camera…");
  const [matches, setMatches] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [cameraFailed, setCameraFailed] = useState(false);

  async function handleCode(text) {
    // goes to storage unit QR, same url
    const path = parseScannedUrl(text, window.location.origin);
    if (path) {
      navigate(path);
      return true;
    }

    // treat it as a product code (sku or _id).
    const result = await Meteor.callAsync("products.findByCode", { code: text });
    if (result.matches.length === 1) {
      navigate(scannedProductRoute(result.matches[0]._id));
      return true;
    }
    if (result.matches.length > 1) {
      setMatches(result.matches);
      setStatus(`Multiple products share "${text}" — pick one:`);
      return false;
    }
    setStatus(
      `No product matches "${text}". Check the product has a SKU set (Edit product → SKU), ` +
        "then reprint its label.",
    );
    return false;
  }

  useEffect(() => {
    const scanner = new Html5Qrcode("scan-region", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 160 } },
        async (decodedText) => {
          if (handlingRef.current) return;
          handlingRef.current = true;
          try {
            const navigated = await handleCode(decodedText);
            if (navigated) return; // page is unmounting
          } catch (err) {
            setStatus(err.reason || err.message || "Lookup failed.");
          }
          // stops awhile
          setTimeout(() => {
            handlingRef.current = false;
          }, 1500);
        },
      )
      .then(() => {
        if (!stopped) setStatus("Point the camera at a barcode or QR code.");
      })
      .catch((err) => {
        setCameraFailed(true);
        setStatus(
          `Camera unavailable: ${err?.message || err}. ` +
            "Allow camera access, or type the code below.",
        );
      });

    return () => {
      stopped = true;
      // StrictMode mounts twice in dev — stop() may reject if never started.
      const teardown = async () => {
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
        } catch {
          /* not running — nothing to stop */
        }
        try {
          scanner.clear();
        } catch {
          /* already cleared */
        }
      };
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManualSubmit(event) {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    try {
      await handleCode(code);
    } catch (err) {
      setStatus(err.reason || err.message || "Lookup failed.");
    }
  }

  return (
    <div className="product-detail-container scan-page">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Tools</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Scan</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">
            Scan <em>Codes</em>
          </h1>
        </div>
      </div>

      <div className="scan-page-body">
        <div className="detail-section scan-camera-card">
          <div id="scan-region" />
          <p className="scan-status">{status}</p>
          <p className="scan-camera-help">
            {cameraFailed ? (
              <Link to="/scan/settings">Camera blocked? Fix it here →</Link>
            ) : (
              <Link to="/scan/settings">Camera settings</Link>
            )}
          </p>
        </div>

        {matches.length > 1 && (
          <div className="detail-section scan-matches">
            {matches.map((match) => (
              <button
                key={match._id}
                type="button"
                className="scan-match-row"
                onClick={() => navigate(scannedProductRoute(match._id))}
              >
                <span className="scan-match-name">{match.name}</span>
                {match.sku && <span className="scan-match-sku">SKU {match.sku}</span>}
              </button>
            ))}
          </div>
        )}

        <form className="detail-section scan-manual" onSubmit={handleManualSubmit}>
          <label className="scan-manual-label" htmlFor="manual-code">
            No camera? Type the code
          </label>
          <div className="scan-manual-row">
            <input
              id="manual-code"
              className="form-input"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="SKU or product ID"
            />
            <button type="submit" className="btn-primary">
              Look up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
