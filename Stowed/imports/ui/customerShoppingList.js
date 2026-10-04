/**
 * Customer shopping list
 *
 * A shopper has no account, so their list is not a Mongo collection - it lives
 * in sessionStorage next to the organisation code, with the same lifetime: it
 * survives reloads and direct URL entry, and is gone when the tab closes.
 *
 * Only { productId, quantity } is stored. The product itself is fetched from
 * the server each time the list is shown, so a name, price or location that
 * changed in the meantime is never served stale out of the shopper's tab.
 *
 * The list belongs to the organisation it was built in, so entering a new one
 * clears it - see startCustomerSession in [customerSession.js].
 */

const SHOPPING_LIST_KEY = "stowed.customer.shoppingList";

function isValidEntry(entry) {
  return (
    entry &&
    typeof entry.productId === "string" &&
    entry.productId.length > 0 &&
    Number.isInteger(entry.quantity) &&
    entry.quantity > 0
  );
}

/**
 * Entries as stored, in the order they were added. Anything malformed is
 * dropped rather than thrown: this is parsing data a previous version of the
 * app (or a shopper with devtools open) may have written.
 */
export function getShoppingList() {
  let raw;
  try {
    raw = window.sessionStorage.getItem(SHOPPING_LIST_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).map(({ productId, quantity }) => ({ productId, quantity }));
  } catch {
    return [];
  }
}

function writeShoppingList(entries) {
  try {
    window.sessionStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(entries));
  } catch {
    // A full or blocked sessionStorage should not take the page down with it;
    // the shopper simply loses the addition.
  }
  return entries;
}

/** Adds to the quantity if the product is already listed, rather than duplicating it. */
export function addToShoppingList(productId, quantity = 1) {
  if (typeof productId !== "string" || !productId) return getShoppingList();
  const amount = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

  const entries = getShoppingList();
  const existing = entries.find((entry) => entry.productId === productId);
  if (existing) {
    existing.quantity += amount;
    return writeShoppingList(entries);
  }
  return writeShoppingList([...entries, { productId, quantity: amount }]);
}

/** A quantity of zero or less removes the item, so callers need no special case. */
export function setShoppingListQuantity(productId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) return removeFromShoppingList(productId);
  return writeShoppingList(
    getShoppingList().map((entry) =>
      entry.productId === productId ? { ...entry, quantity } : entry,
    ),
  );
}

export function removeFromShoppingList(productId) {
  return writeShoppingList(getShoppingList().filter((entry) => entry.productId !== productId));
}

export function clearShoppingList() {
  try {
    window.sessionStorage.removeItem(SHOPPING_LIST_KEY);
  } catch {
    // Nothing to do - the list is already unreachable.
  }
}

/**
 * Drops entries whose product is no longer in the catalogue, so a list cannot
 * keep pointing at something the store has deleted. Returns the entries kept.
 */
export function pruneShoppingList(knownProductIds) {
  const entries = getShoppingList();
  const kept = entries.filter((entry) => knownProductIds.has(entry.productId));
  if (kept.length !== entries.length) writeShoppingList(kept);
  return kept;
}
