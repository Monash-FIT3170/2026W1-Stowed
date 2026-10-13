/**
 * Turns the customer catalogue (customer.products.list) into what the public
 * floor map needs: one entry per product per shelf it sits on.
 *
 * The catalogue labels each location "Unit · Shelf" and never sends quantities,
 * so the shelf name is recovered from that label and stock is shown as the
 * status the server already worked out.
 */

const LABEL_SEPARATOR = " · ";

/** The server joins unit and shelf as `unitName · shelfName`; undo that join. */
function shelfNameFromLabel(label, unitName) {
  if (!unitName) return label;
  if (label === unitName) return "";
  const prefix = `${unitName}${LABEL_SEPARATOR}`;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

/**
 * @param {Array} products - Customer products, each with `locations`.
 * @returns {Array<{ key: string, product: object, unitId: string, unitName: string,
 *   shelfName: string, label: string }>}
 */
export function buildPlacements(products = []) {
  const placements = [];
  for (const product of products) {
    for (const location of product.locations ?? []) {
      if (!location.unitId) continue;
      placements.push({
        key: `${product._id}|${location.label}`,
        product,
        unitId: location.unitId,
        unitName: location.unitName,
        shelfName: shelfNameFromLabel(location.label, location.unitName),
        label: location.label,
      });
    }
  }
  return placements;
}

/**
 * Groups one unit's placements by shelf, shelves and products alphabetical.
 *
 * @returns {Array<{ shelfName: string, products: Array<object> }>}
 */
export function groupUnitByShelf(placements, unitId) {
  const byShelf = new Map();
  for (const placement of placements) {
    if (placement.unitId !== unitId) continue;
    if (!byShelf.has(placement.shelfName)) byShelf.set(placement.shelfName, []);
    byShelf.get(placement.shelfName).push(placement.product);
  }

  return [...byShelf.entries()]
    .map(([shelfName, products]) => ({
      shelfName,
      products: products.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    }))
    .sort((a, b) => a.shelfName.localeCompare(b.shelfName));
}
