import { useRef, useState } from "react";
import {
  addToShoppingList,
  getShoppingListQuantities,
  removeFromShoppingList,
  setShoppingListQuantity,
} from "../customerShoppingList";
import "./ShoppingListControl.css";

/**
 * Quantity stepper and add/remove button for one product.
 *
 * Two modes, told apart by whether the product is already listed:
 *
 *  - Not listed: the stepper is a draft, starting at 1, and nothing is written
 *    until "Add to shopping list" is pressed.
 *  - Listed: the stepper *is* the list quantity, so stepping writes straight
 *    through, and the button removes the item.
 *
 * Self-contained on purpose - each card owns its own control, so one card's
 * state cannot go stale when a neighbour is added. Where the surrounding page
 * also renders from the list (the shopping list itself), onChange hands it the
 * new entries so it can follow along.
 *
 * variant "card" is the foot of a product card: stepper plus add/remove button.
 * variant "row" is a cell in the shopping list, where every item is on the list
 * already - the stepper alone, with minus at one removing the row.
 */

const MAX_QUANTITY = 99;

const clamp = (value) => Math.min(MAX_QUANTITY, Math.max(1, value));

export function ShoppingListControl({ productId, productName, variant = "card", onChange }) {
  // listed is null when the product is not on the list, otherwise its quantity.
  // draft is what the stepper holds before anything is added.
  const [state, setState] = useState(() => ({
    listed: getShoppingListQuantities().get(productId) ?? null,
    draft: 1,
  }));

  // The handlers read through this rather than the render closure: two clicks
  // inside one render batch would otherwise both see the same starting value,
  // and a quick double tap on + would only count once. apply() is the only way
  // state changes, so the ref cannot drift from it and needs no resync here.
  const stateRef = useRef(state);

  const apply = (next, entries) => {
    stateRef.current = next;
    setState(next);
    if (entries && onChange) onChange(entries);
  };

  const onList = state.listed !== null;
  const quantity = onList ? state.listed : state.draft;

  // Stepping down off the last one removes the item, so a shopper can undo an
  // add without reaching for the button. A draft has nothing to remove, so it
  // stops at 1 instead - see minusDisabled below.
  const willRemove = onList && quantity === 1;

  const step = (delta) => {
    const current = stateRef.current;
    const listed = current.listed !== null;

    if (listed && delta < 0 && current.listed === 1) {
      apply({ listed: null, draft: 1 }, removeFromShoppingList(productId));
      return;
    }

    const from = listed ? current.listed : current.draft;
    const next = clamp(from + delta);
    if (next === from) return;

    if (listed) {
      apply({ ...current, listed: next }, setShoppingListQuantity(productId, next));
      return;
    }
    // A draft is not on the list yet, so nothing to tell the page about.
    apply({ ...current, draft: next });
  };

  const toggle = () => {
    const current = stateRef.current;

    if (current.listed !== null) {
      // Back to a fresh draft, so the card reads the same as one never added.
      apply({ listed: null, draft: 1 }, removeFromShoppingList(productId));
      return;
    }
    apply({ ...current, listed: current.draft }, addToShoppingList(productId, current.draft));
  };

  const subject = productName || "this item";

  return (
    <div className={`slc slc-${variant}`}>
      <div className="slc-stepper">
        <button
          type="button"
          className={`slc-step${willRemove ? " will-remove" : ""}`}
          onClick={() => step(-1)}
          /* Only a draft floors the minus: on the list there is always
             something left to take away, even at one. */
          disabled={!onList && quantity <= 1}
          aria-label={
            willRemove ? `Remove ${subject} from shopping list` : `Decrease quantity for ${subject}`
          }
        >
          &minus;
        </button>
        <span className="slc-quantity" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          className="slc-step"
          onClick={() => step(1)}
          disabled={quantity >= MAX_QUANTITY}
          aria-label={`Increase quantity for ${subject}`}
        >
          +
        </button>
      </div>

      {variant === "card" && (
        <button
          type="button"
          className={`slc-action${onList ? " on-list" : ""}`}
          onClick={toggle}
          aria-label={
            onList ? `Remove ${subject} from shopping list` : `Add ${subject} to shopping list`
          }
        >
          {onList ? "Remove from list" : "Add to shopping list"}
        </button>
      )}
    </div>
  );
}
