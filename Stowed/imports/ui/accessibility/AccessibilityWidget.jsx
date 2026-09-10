import { useEffect, useId, useRef, useState } from "react";
import "./accessibility.css";

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
  const panelId = useId();
  const containerRef = useRef(null);

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
          <h2 className="a11y-panel-title">Accessibility</h2>
          <p className="a11y-panel-empty">Options coming soon.</p>
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
