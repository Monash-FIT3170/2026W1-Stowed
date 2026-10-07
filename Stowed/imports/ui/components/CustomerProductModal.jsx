import { useEffect, useRef } from "react";
import { CustomerProductDetails } from "./CustomerProductDetails";
import "./CustomerProductModal.css";

/**
 * "More info" from the shopping list, as a dialog over the list.
 *
 * The product is passed in rather than fetched: the list already holds the
 * whole catalogue to build its rows from, so opening is instant and costs no
 * round trip. The contents are the same component the detail page renders.
 */
export function CustomerProductModal({ product, onClose }) {
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    // Whatever had focus when the dialog opened gets it back on close, so
    // dismissing returns the shopper to the row they came from.
    openerRef.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // The page behind must not scroll under the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay customer-modal-overlay"
      role="presentation"
      // Only a click that starts and ends on the backdrop itself dismisses:
      // a drag that began inside the dialog must not close it on release.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal customer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
      >
        <button
          ref={closeRef}
          type="button"
          className="customer-modal-close"
          onClick={onClose}
          aria-label="Close product details"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="customer-modal-body">
          <CustomerProductDetails product={product} />
        </div>
      </div>
    </div>
  );
}
