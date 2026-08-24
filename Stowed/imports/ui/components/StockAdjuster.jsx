import { useState } from "react";
import { Meteor } from "meteor/meteor";

/**
 * Used after a scan: [-] qty [+]
 *
 * props:
 *  - productId, locationId
 *  - quantity     current quantity (from the live ProductRecord)
 *  - onError      optional callback(message)
 */
export function StockAdjuster({ productId, locationId, quantity, compact = false, onError }) {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState("");

  async function adjust(delta) {
    if (busy) return;
    setBusy(true);
    try {
      await Meteor.callAsync("products.adjustStock", { productId, locationId, delta });
    } catch (err) {
      onError?.(err.reason || err.message || "Could not update stock.");
    } finally {
      setBusy(false);
    }
  }

  async function applyCount(event) {
    event.preventDefault();
    const parsed = parseInt(count, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      onError?.("Enter a whole number of 0 or more.");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await Meteor.callAsync("products.setStock", { productId, locationId, quantity: parsed });
      setCount("");
    } catch (err) {
      onError?.(err.reason || err.message || "Could not update stock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`stock-adjuster${compact ? " compact" : ""}`}>
      <div className="stock-adjuster-stepper">
        <button
          type="button"
          className="stock-adjuster-btn"
          onClick={() => adjust(-1)}
          disabled={busy || quantity <= 0}
          aria-label="Remove one"
        >
          −
        </button>
        <span className="stock-adjuster-qty" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          className="stock-adjuster-btn"
          onClick={() => adjust(1)}
          disabled={busy}
          aria-label="Add one"
        >
          +
        </button>
      </div>

      {!compact && (
        <form className="stock-adjuster-set" onSubmit={applyCount}>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className="form-input"
            placeholder="Counted"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            aria-label="Set counted quantity"
          />
          <button type="submit" className="btn-secondary" disabled={busy || count === ""}>
            Set
          </button>
        </form>
      )}
    </div>
  );
}
