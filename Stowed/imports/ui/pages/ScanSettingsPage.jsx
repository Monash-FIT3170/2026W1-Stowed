import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../Global.css";
import "./ScanSettingsPage.css";

const STATE_LABEL = {
  granted: "Camera allowed",
  prompt: "Camera will ask for permission",
  denied: "Camera blocked",
  unsupported: "Camera not available in this browser",
  unknown: "Checking…",
};

function detectBrowser() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "safari";
  return "chrome"; // Chrome, Edge, Brave, Arc all share the site-info flow
}

const INSTRUCTIONS = {
  chrome: [
    "Click the icon at the left of the address bar (a lock, tune sliders, or ⓘ).",
    'Find "Camera" and switch it to Allow — or open "Site settings" and reset permissions.',
    "Reload this page, then press Test camera below.",
  ],
  safari: [
    "Safari menu → Settings for This Website… (or right-click the address bar).",
    'Set "Camera" to Allow.',
    "Reload this page, then press Test camera below.",
  ],
  firefox: [
    "Click the lock icon at the left of the address bar.",
    'Under Permissions, find "Use the Camera" and click the ✕ next to Blocked to clear it.',
    "Reload this page — the browser will ask again the next time you scan.",
  ],
  android: [
    "Tap the lock / tune icon at the left of the address bar → Permissions.",
    'Set "Camera" to Allow. If it is not listed, open Android Settings → Apps → your browser → Permissions → Camera.',
    "Reload this page, then press Test camera below.",
  ],
  ios: [
    "Open the iPhone Settings app → scroll to your browser (Safari or Chrome).",
    'Set "Camera" to Allow (Safari: also check Settings → Safari → Camera → Allow).',
    "Return to this page and press Test camera below.",
  ],
};

/**
 * Camera permission help page. Browsers never let a site re-ask after the
 * user clicked "Block", so this page detects the current state, shows how to
 * unblock in the browser itself, and offers a "Test camera" check.
 */
export function ScanSettingsPage() {
  const [permission, setPermission] = useState("unknown");
  const [testMessage, setTestMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const browser = detectBrowser();
  const secure = typeof window !== "undefined" && window.isSecureContext;

  useEffect(() => {
    let cancelled = false;
    let permissionStatus = null;

    async function query() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setPermission("unsupported");
        return;
      }
      if (!navigator.permissions?.query) {
        if (!cancelled) setPermission("prompt"); // Safari <16: can't query, must try
        return;
      }
      try {
        permissionStatus = await navigator.permissions.query({ name: "camera" });
        if (cancelled) return;
        setPermission(permissionStatus.state);
        permissionStatus.onchange = () => setPermission(permissionStatus.state);
      } catch {
        if (!cancelled) setPermission("prompt");
      }
    }
    query();

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  async function testCamera() {
    setTesting(true);
    setTestMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      setTestMessage("Camera works — you can go back and scan.");
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermission("denied");
        setTestMessage("Still blocked. Follow the steps below, reload, and test again.");
      } else if (name === "NotFoundError") {
        setPermission("unsupported");
        setTestMessage("No camera found on this device. Use the manual code entry instead.");
      } else {
        setTestMessage(`Could not start camera: ${err?.message || name || "unknown error"}.`);
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="product-detail-container scan-settings-page">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Tools</span>
          <span className="breadcrumb-separator">/</span>
          <Link to="/scan" className="breadcrumb-link">
            Scan
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Camera settings</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">
            Camera <em>settings</em>
          </h1>
          <Link to="/scan" className="btn-secondary" style={{ textDecoration: "none" }}>
            ← Back to scan
          </Link>
        </div>
      </div>

      <div className="scan-settings-body">
        <div className="detail-section scan-settings-card">
          <div className="scan-settings-status">
            <span className={`scan-settings-pill ${permission}`}>{STATE_LABEL[permission]}</span>
            <button
              type="button"
              className="btn-primary"
              onClick={testCamera}
              disabled={testing || permission === "unsupported"}
            >
              {testing ? "Testing…" : "Test camera"}
            </button>
          </div>
          {testMessage && <p className="scan-settings-message">{testMessage}</p>}
          {!secure && (
            <p className="scan-settings-warning">
              Camera access needs a secure connection (HTTPS or localhost). This page is on
              plain HTTP, so the browser will refuse the camera regardless of permission.
            </p>
          )}
        </div>

        {permission !== "granted" && (
          <div className="detail-section scan-settings-card">
            <h2 className="section-title">How to re-allow the camera</h2>
            <div className="section-content">
              <p className="scan-settings-note">
                Once a site is blocked, browsers do not let the site ask again — you have to
                unblock it in the browser itself. Steps for your browser:
              </p>
              <ol className="scan-settings-steps">
                {INSTRUCTIONS[browser].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        )}

        <div className="detail-section scan-settings-card">
          <div className="section-content">
            <p className="scan-settings-note">
              No camera? You can still type a SKU or product ID on the{" "}
              <Link to="/scan">Scan page</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
