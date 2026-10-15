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

/**
 * Where each storage unit on a public map can be shown: its map, and a label
 * naming that map for results that are not on the one being viewed. The
 * site is named only when it has more than one public map, where the map
 * name alone could be ambiguous across sites.
 *
 * @returns {Map<string, { floorMapId: string, mapLabel: string }>}
 */
export function buildUnitMaps(storageUnits, visibleMaps, visibleSites) {
  const mapsById = new Map(visibleMaps.map((map) => [map._id, map]));
  const sitesById = new Map(visibleSites.map((site) => [site._id, site]));
  const mapsPerSite = new Map();
  for (const map of visibleMaps) {
    mapsPerSite.set(map.siteId, (mapsPerSite.get(map.siteId) ?? 0) + 1);
  }

  const unitMaps = new Map();
  for (const unit of storageUnits) {
    const map = mapsById.get(unit.floorMapId);
    if (!map) continue;
    const siteName = sitesById.get(map.siteId)?.name;
    const mapLabel =
      siteName && mapsPerSite.get(map.siteId) > 1 ? `${siteName} · ${map.name}` : map.name;
    unitMaps.set(unit._id, { floorMapId: map._id, mapLabel });
  }
  return unitMaps;
}

/**
 * Orders map-search rows: on the map being viewed first, then on another
 * public map, then nowhere a shopper can be shown; within each, by product
 * name then location label.
 */
export function rankSearchRows(rows, currentMapId, unitMaps) {
  const tier = (row) => {
    const map = unitMaps.get(row.unitId);
    if (!map) return 2;
    return map.floorMapId === currentMapId ? 0 : 1;
  };
  return [...rows].sort(
    (a, b) =>
      tier(a) - tier(b) ||
      (a.product.name || "").localeCompare(b.product.name || "") ||
      a.label.localeCompare(b.label),
  );
}
