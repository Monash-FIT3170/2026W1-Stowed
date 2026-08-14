import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { parseScannedUrl } from "/imports/api/products/codes";
import "./ScanPage.css";

/**
 * Camera scanner for product barcodes (Code-128) and storage unit QR codes.
 *  - QR with our own URL  -> navigate straight to that page
 *  - anything else        -> products.findByCode (sku, then _id) and navigate
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
      navigate(`/inventory/${result.matches[0]._id}`);
      return true;
    }
    if (result.matches.length > 1) {
      setMatches(result.matches);
      setStatus(`Multiple products share "${text}" — pick one:`);
      return false;
    }
    setStatus(`No product found for "${text}". Keep scanning.`);
    return false;
  }

  useEffect(() => {
    const scanner = new Html5Qrcode("scan-region", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
      ],
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
        setStatus(
          `Camera unavailable: ${err?.message || err}. ` +
            "Allow camera access, or type the code below.",
        );
      });

    return () => {
      stopped = true;
      // StrictMode mounts twice in dev — stop() may reject if never started.
      scanner
        .stop()
        .catch(() => {})
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            /* already cleared */
          }
        });
    };
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
    <div className="scan-page">
      {/* MOCKUP UI — styling is the last step */}
      <h1>Scan</h1>
      <p>{status}</p>

      <div id="scan-region" />

      {matches.length > 1 && (
        <ul>
          {matches.map((match) => (
            <li key={match._id}>
              <button type="button" onClick={() => navigate(`/inventory/${match._id}`)}>
                {match.name} {match.sku ? `(${match.sku})` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleManualSubmit}>
        <label htmlFor="manual-code">No camera? Type the code: </label>
        <input
          id="manual-code"
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
          placeholder="SKU or product ID"
        />
        <button type="submit">Look up</button>
      </form>
    </div>
  );
}
