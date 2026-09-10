import { useEffect, useId, useRef, useState } from "react";
import "./accessibility.css";

const CONTRAST_STORAGE_KEY = "stowed.a11y.highContrast";
const TEXT_SIZE_STORAGE_KEY = "stowed.a11y.textSize";
const LARGE_CURSOR_STORAGE_KEY = "stowed.a11y.largeCursor";
const ZOOM_STORAGE_KEY = "stowed.a11y.zoom";

const TEXT_SIZE_OPTIONS = [
  { id: "default", label: "Default", scale: 1 },
  { id: "large", label: "Large", scale: 1.15 },
  { id: "larger", label: "Larger", scale: 1.3 },
];

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

function clampZoom(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

function readContrastPreference() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(CONTRAST_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function readTextSizePreference() {
  if (typeof window === "undefined" || !window.localStorage) return "default";
  try {
    const stored = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    return TEXT_SIZE_OPTIONS.some((option) => option.id === stored) ? stored : "default";
  } catch {
    return "default";
  }
}

function readLargeCursorPreference() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(LARGE_CURSOR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function readZoomPreference() {
  if (typeof window === "undefined" || !window.localStorage) return 1;
  try {
    return clampZoom(parseFloat(window.localStorage.getItem(ZOOM_STORAGE_KEY)));
  } catch {
    return 1;
  }
}

function AccessibilityIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="12" cy="3.8" r="2" fill="currentColor" />
      <path
        d="M4.4 6.2a1 1 0 0 1 1.2-.4c1.9.7 4 1.1 6.4 1.1s4.5-.4 6.4-1.1a1 1 0 1 1 .7 1.9c-1.5.5-3.1.9-4.8 1.1l.7 4.1 1.6 6.2a1 1 0 0 1-1.9.5L12 15.6l-1.9 5.9a1 1 0 0 1-1.9-.5l1.6-6.2.7-4.1c-1.7-.2-3.3-.6-4.8-1.1a1 1 0 0 1-.5-1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(readContrastPreference);
  const [textSize, setTextSize] = useState(readTextSizePreference);
  const [largeCursor, setLargeCursor] = useState(readLargeCursorPreference);
  const [zoom, setZoom] = useState(readZoomPreference);
  const panelId = useId();
  const textSizeLabelId = `${panelId}-text-size`;
  const zoomLabelId = `${panelId}-zoom`;
  const containerRef = useRef(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("a11y-contrast", highContrast);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(CONTRAST_STORAGE_KEY, String(highContrast));
      } catch {
        // storage unavailable (private mode / quota) — the setting still applies this session
      }
    }
  }, [highContrast]);

  useEffect(() => {
    const scale = TEXT_SIZE_OPTIONS.find((option) => option.id === textSize)?.scale ?? 1;
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--a11y-font-scale", String(scale));
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, textSize);
      } catch {
        // storage unavailable (private mode / quota) — the setting still applies this session
      }
    }
  }, [textSize]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("a11y-large-cursor", largeCursor);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(LARGE_CURSOR_STORAGE_KEY, String(largeCursor));
      } catch {
        // storage unavailable (private mode / quota) — the setting still applies this session
      }
    }
  }, [largeCursor]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--a11y-zoom", String(zoom));
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
      } catch {
        // storage unavailable (private mode / quota) — the setting still applies this session
      }
    }
  }, [zoom]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="a11y-widget" ref={containerRef}>
      {open && (
        <div className="a11y-panel" id={panelId} role="dialog" aria-label="Accessibility">
          <div className="a11y-panel-head">
            <h2 className="a11y-panel-title">Accessibility</h2>
            <button
              type="button"
              className="a11y-panel-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="a11y-row">
            <span className="a11y-row-label" id={textSizeLabelId}>
              Text size
            </span>
            <div className="a11y-segmented" role="group" aria-labelledby={textSizeLabelId}>
              {TEXT_SIZE_OPTIONS.map((option) => {
                const active = textSize === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`a11y-segment${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setTextSize(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="a11y-row">
            <span className="a11y-row-label" id={zoomLabelId}>
              Zoom
            </span>
            <div className="a11y-stepper" role="group" aria-labelledby={zoomLabelId}>
              <button
                type="button"
                className="a11y-stepper-btn"
                aria-label="Zoom out"
                disabled={zoom <= ZOOM_MIN}
                onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
              >
                −
              </button>
              <span className="a11y-stepper-value">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="a11y-stepper-btn"
                aria-label="Zoom in"
                disabled={zoom >= ZOOM_MAX}
                onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
              >
                +
              </button>
            </div>
          </div>

          <div className="a11y-divider" />

          <label className="a11y-toggle">
            <span className="a11y-toggle-label">High contrast</span>
            <span className="a11y-switch">
              <input
                type="checkbox"
                checked={highContrast}
                onChange={() => setHighContrast((current) => !current)}
              />
              <span className="a11y-switch-track" aria-hidden="true" />
              <span className="a11y-switch-thumb" aria-hidden="true" />
            </span>
          </label>

          <label className="a11y-toggle">
            <span className="a11y-toggle-label">Large cursor</span>
            <span className="a11y-switch">
              <input
                type="checkbox"
                checked={largeCursor}
                onChange={() => setLargeCursor((current) => !current)}
              />
              <span className="a11y-switch-track" aria-hidden="true" />
              <span className="a11y-switch-thumb" aria-hidden="true" />
            </span>
          </label>
        </div>
      )}

      <button
        type="button"
        className="a11y-block"
        aria-label="Accessibility options"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <AccessibilityIcon />
        <span>Accessibility</span>
      </button>
    </div>
  );
}
