import { Products, ProductRecords } from "../products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
  FloorMapRoutes,
} from "../locations/collections";
import { getCallerOrgId } from "../userMethods";

const MATCH_LIMIT = 8;

export const DIRECTIONS_CHOICE_KINDS = {
  PRODUCTS: "directions-products",
  FLOOR: "directions-floor",
  SITE: "directions-site",
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeChoiceId(kind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function findProductMatches(orgId, query) {
  const text = String(query || "").trim();
  if (!text) return [];

  const exact = await Products.findOneAsync({
    orgId,
    name: new RegExp(`^${escapeRegex(text)}$`, "i"),
  });
  if (exact) return [exact];

  const phrase = new RegExp(escapeRegex(text), "i");
  const words = text.split(/\s+/).filter((word) => word.length > 1);
  return await Products.find(
    {
      orgId,
      $or: [
        { name: phrase },
        { sku: phrase },
        { brand: phrase },
        ...(words.length > 1
          ? [{ $and: words.map((word) => ({ name: new RegExp(escapeRegex(word), "i") })) }]
          : []),
      ],
    },
    { sort: { name: 1 }, limit: MATCH_LIMIT },
  ).fetchAsync();
}

/**
 * Finds, for each floor map that has a saved route, which of the products are in stock at a
 * storage location the route can reach (a product node lists that location).
 *
 * @returns {Promise<Map<string, { floorMap: Object, site: Object | undefined, productIds: Set<string> }>>}
 */
async function findFloorAvailability(orgId, productIds) {
  const records = await ProductRecords.find({
    productId: { $in: productIds },
    quantity: { $gt: 0 },
  }).fetchAsync();
  if (records.length === 0) return new Map();

  const locations = await StorageLocations.find({
    _id: { $in: [...new Set(records.map((record) => record.locationId))] },
  }).fetchAsync();
  const units = await StorageUnits.find({
    _id: { $in: [...new Set(locations.map((location) => location.storageUnitId))] },
  }).fetchAsync();
  const floorMaps = await FloorMaps.find({
    _id: { $in: [...new Set(units.map((unit) => unit.floorMapId))] },
    orgId,
  }).fetchAsync();
  const routes = await FloorMapRoutes.find({
    floorMapId: { $in: floorMaps.map((floorMap) => floorMap._id) },
    orgId,
  }).fetchAsync();
  const sites = await Sites.find({
    _id: { $in: [...new Set(floorMaps.map((floorMap) => floorMap.siteId))] },
  }).fetchAsync();

  const unitById = new Map(units.map((unit) => [unit._id, unit]));
  const locationById = new Map(locations.map((location) => [location._id, location]));
  const siteById = new Map(sites.map((site) => [site._id, site]));
  const routeByFloorMapId = new Map(routes.map((route) => [route.floorMapId, route]));

  const available = new Map();
  for (const floorMap of floorMaps) {
    const route = routeByFloorMapId.get(floorMap._id);
    if (!route) continue;
    const reachableLocationIds = new Set(
      route.nodes.flatMap((node) => node.storageLocationIds ?? []),
    );

    const productIdsHere = new Set();
    for (const record of records) {
      const location = locationById.get(record.locationId);
      const unit = location && unitById.get(location.storageUnitId);
      if (unit?.floorMapId === floorMap._id && reachableLocationIds.has(record.locationId)) {
        productIdsHere.add(record.productId);
      }
    }
    if (productIdsHere.size > 0) {
      available.set(floorMap._id, {
        floorMap,
        site: siteById.get(floorMap.siteId),
        productIds: productIdsHere,
      });
    }
  }
  return available;
}

const floorLabel = ({ floorMap, site }) =>
  site ? `${site.name} – ${floorMap.name}` : floorMap.name;

function makeChoice(kind, { prompt, multiSelect, options, context }) {
  return { type: "choice", id: makeChoiceId(kind), kind, prompt, multiSelect, options, context };
}

function productsBySite(availability) {
  const bySite = new Map();
  for (const entry of availability.values()) {
    const siteId = entry.floorMap.siteId;
    if (!bySite.has(siteId)) bySite.set(siteId, { site: entry.site, productIds: new Set() });
    entry.productIds.forEach((id) => bySite.get(siteId).productIds.add(id));
  }
  return bySite;
}

/**
 * Works out what to do for a "directions to a product" request. Either it has everything it needs
 * and returns a `directions` action for the client to open, or it returns the next question as a
 * `choice` action (so answers are clicks, never free text), or it explains why it can't.
 *
 * Order of questions: which site (only when the matching products are stocked at more than one),
 * then which products (only when a name matches several), then which floor (only when several
 * floors cover the products equally well).
 *
 * @param {{ userId: string, productQueries?: string[], productIds?: string[], floorMapId?: string, siteId?: string }} params
 * @returns {Promise<{ status: string, message: string, actions: Object[] }>}
 */
export async function resolveDirections({
  userId,
  productQueries = [],
  productIds = [],
  floorMapId,
  siteId,
}) {
  const orgId = await getCallerOrgId(userId);

  const resolved = new Map();
  if (productIds.length > 0) {
    const known = await Products.find({ _id: { $in: productIds }, orgId }).fetchAsync();
    known.forEach((product) => resolved.set(product._id, product));
  }

  const ambiguousGroups = [];
  const notFound = [];
  for (const query of productQueries) {
    const matches = await findProductMatches(orgId, query);
    if (matches.length === 0) notFound.push(query);
    else if (matches.length === 1) resolved.set(matches[0]._id, matches[0]);
    else ambiguousGroups.push({ query, matches });
  }

  let preferredSiteId = siteId;
  const notStockedHere = [];

  if (ambiguousGroups.length > 0) {
    const pool = new Map(resolved);
    ambiguousGroups.forEach(({ matches }) =>
      matches.forEach((product) => pool.set(product._id, product)),
    );
    const poolAvailability = await findFloorAvailability(orgId, [...pool.keys()]);
    const siteStock = productsBySite(poolAvailability);

    if (!preferredSiteId && siteStock.size > 1) {
      return {
        status: "choice_shown",
        message: "Those are stocked at more than one site. Which site are you at?",
        actions: [
          makeChoice(DIRECTIONS_CHOICE_KINDS.SITE, {
            prompt: "Which site are you at?",
            multiSelect: false,
            options: [...siteStock.entries()].map(([id, { site, productIds: ids }]) => ({
              value: id,
              label: site?.name ?? "Unknown site",
              detail: `${ids.size} matching product${ids.size === 1 ? "" : "s"} in stock`,
            })),
            context: {
              productIds: [...resolved.keys()],
              productQueries: ambiguousGroups.map((group) => group.query),
            },
          }),
        ],
      };
    }
    if (!preferredSiteId && siteStock.size === 1) preferredSiteId = [...siteStock.keys()][0];

    const allowed = preferredSiteId
      ? (siteStock.get(preferredSiteId)?.productIds ?? new Set())
      : new Set();
    const options = [];
    for (const { query, matches } of ambiguousGroups) {
      const here = matches.filter((product) => allowed.has(product._id));
      if (here.length === 0) notStockedHere.push(query);
      else if (here.length === 1) resolved.set(here[0]._id, here[0]);
      else options.push(...here);
    }

    if (options.length > 0) {
      return {
        status: "choice_shown",
        message: "A few products match. Tick every one you want directions to.",
        actions: [
          makeChoice(DIRECTIONS_CHOICE_KINDS.PRODUCTS, {
            prompt: "Which products do you want directions to?",
            multiSelect: true,
            options: [...new Map(options.map((product) => [product._id, product])).values()]
              .filter((product) => !resolved.has(product._id))
              .map((product) => ({
                value: product._id,
                label: product.name,
                detail: [product.brand, product.sku].filter(Boolean).join(" · "),
              })),
            context: { productIds: [...resolved.keys()], siteId: preferredSiteId },
          }),
        ],
      };
    }
  }

  if (resolved.size === 0) {
    const unknown = [...notFound, ...notStockedHere];
    return {
      status: unknown.length > 0 ? "not_found" : "need_products",
      message:
        unknown.length > 0
          ? `I couldn't find ${unknown.map((name) => `"${name}"`).join(", ")} in stock anywhere with a route. Ask the user what the product is called.`
          : "Ask the user which product (or products) they want directions to.",
      actions: [],
    };
  }

  const availability = await findFloorAvailability(orgId, [...resolved.keys()]);
  if (availability.size === 0) {
    return {
      status: "unavailable",
      message:
        "None of those products are in stock somewhere with a walkable route on the floor map, so there are no directions to give.",
      actions: [],
    };
  }

  const bySize = (a, b) => b.productIds.size - a.productIds.size;
  const maxCoverage = (entries) => Math.max(...entries.map((entry) => entry.productIds.size));
  const entries = [...availability.values()];

  // Prefer the site the user said they are at, if it has any of the products
  const inSite = preferredSiteId
    ? entries.filter((entry) => entry.floorMap.siteId === preferredSiteId)
    : [];
  const pool = inSite.length > 0 ? inSite : entries;
  const best = maxCoverage(pool);
  let candidates = pool.filter((entry) => entry.productIds.size === best);
  // Anywhere that covers at least as much can be switched to from the map
  const switchable = entries.filter((entry) => entry.productIds.size >= best).sort(bySize);

  const chosen = floorMapId && switchable.find((entry) => entry.floorMap._id === floorMapId);
  if (chosen) candidates = [chosen];

  if (candidates.length > 1) {
    return {
      status: "choice_shown",
      message: "That's stocked on more than one floor. Which floor are you on?",
      actions: [
        makeChoice(DIRECTIONS_CHOICE_KINDS.FLOOR, {
          prompt: "Which floor are you on?",
          multiSelect: false,
          options: candidates.map((entry) => ({
            value: entry.floorMap._id,
            label: floorLabel(entry),
            detail: `${entry.productIds.size} of ${resolved.size} product${resolved.size === 1 ? "" : "s"} in stock here`,
          })),
          context: { productIds: [...resolved.keys()], siteId: preferredSiteId },
        }),
      ],
    };
  }

  const [entry] = candidates;
  const pickable = [...entry.productIds];
  const missing = [...resolved.values()].filter((product) => !entry.productIds.has(product._id));
  const productNames = Object.fromEntries(
    [...resolved.values()].map((product) => [product._id, product.name]),
  );
  const floors = switchable.map((other) => ({
    floorMapId: other.floorMap._id,
    floorName: other.floorMap.name,
    siteName: other.site?.name ?? "",
    productIds: [...other.productIds],
  }));

  return {
    status: "directions_opened",
    message:
      `Opening the ${floorLabel(entry)} map. Click where you are standing and I'll draw the shortest route.` +
      (missing.length > 0
        ? ` Note: ${missing.map((product) => product.name).join(", ")} isn't in stock on this floor.`
        : "") +
      (notStockedHere.length > 0
        ? ` Nothing matching ${notStockedHere.map((name) => `"${name}"`).join(", ")} is in stock at this site.`
        : ""),
    actions: [
      {
        type: "directions",
        floorMapId: entry.floorMap._id,
        floorName: entry.floorMap.name,
        siteName: entry.site?.name ?? "",
        productIds: pickable,
        productNames,
        floors,
      },
    ],
  };
}
