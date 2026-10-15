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

/**
 * Works out what to do for a "directions to a product" request. Either it has everything it needs
 * and returns a `directions` action for the client to open, or it returns the next question as a
 * `choice` action (so answers are clicks, never free text), or it explains why it can't.
 *
 * @param {{ userId: string, productQueries?: string[], productIds?: string[], floorMapId?: string }} params
 * @returns {Promise<{ status: string, message: string, actions: Object[] }>}
 */
export async function resolveDirections({
  userId,
  productQueries = [],
  productIds = [],
  floorMapId,
}) {
  const orgId = await getCallerOrgId(userId);

  const resolved = new Map();
  if (productIds.length > 0) {
    const known = await Products.find({ _id: { $in: productIds }, orgId }).fetchAsync();
    known.forEach((product) => resolved.set(product._id, product));
  }

  const ambiguous = [];
  const notFound = [];
  for (const query of productQueries) {
    const matches = await findProductMatches(orgId, query);
    if (matches.length === 0) notFound.push(query);
    else if (matches.length === 1) resolved.set(matches[0]._id, matches[0]);
    else ambiguous.push(...matches);
  }

  if (ambiguous.length > 0) {
    const options = [...new Map(ambiguous.map((product) => [product._id, product])).values()]
      .filter((product) => !resolved.has(product._id))
      .map((product) => ({
        value: product._id,
        label: product.name,
        detail: [product.brand, product.sku].filter(Boolean).join(" · "),
      }));
    return {
      status: "choice_shown",
      message: "A few products match. Tick every one you want directions to.",
      actions: [
        {
          type: "choice",
          id: makeChoiceId(DIRECTIONS_CHOICE_KINDS.PRODUCTS),
          kind: DIRECTIONS_CHOICE_KINDS.PRODUCTS,
          prompt: "Which products do you want directions to?",
          multiSelect: true,
          options,
          context: { productIds: [...resolved.keys()] },
        },
      ],
    };
  }

  if (resolved.size === 0) {
    return {
      status: notFound.length > 0 ? "not_found" : "need_products",
      message:
        notFound.length > 0
          ? `I couldn't find a product matching ${notFound.map((name) => `"${name}"`).join(", ")}. Ask the user what the product is called.`
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

  const mostCovered = Math.max(...[...availability.values()].map((entry) => entry.productIds.size));
  let candidates = [...availability.values()].filter(
    (entry) => entry.productIds.size === mostCovered,
  );

  const chosen = floorMapId && candidates.find((entry) => entry.floorMap._id === floorMapId);
  if (chosen) candidates = [chosen];

  if (candidates.length > 1) {
    return {
      status: "choice_shown",
      message: "That's stocked on more than one floor. Which floor are you on?",
      actions: [
        {
          type: "choice",
          id: makeChoiceId(DIRECTIONS_CHOICE_KINDS.FLOOR),
          kind: DIRECTIONS_CHOICE_KINDS.FLOOR,
          prompt: "Which floor are you on?",
          multiSelect: false,
          options: candidates.map((entry) => ({
            value: entry.floorMap._id,
            label: floorLabel(entry),
            detail: `${entry.productIds.size} of ${resolved.size} product${resolved.size === 1 ? "" : "s"} in stock here`,
          })),
          context: { productIds: [...resolved.keys()] },
        },
      ],
    };
  }

  const [entry] = candidates;
  const pickable = [...entry.productIds];
  const missing = [...resolved.values()].filter((product) => !entry.productIds.has(product._id));
  const productNames = Object.fromEntries(pickable.map((id) => [id, resolved.get(id).name]));

  return {
    status: "directions_opened",
    message:
      `Opening the ${floorLabel(entry)} map. Click where you are standing and I'll draw the shortest route.` +
      (missing.length > 0
        ? ` Note: ${missing.map((product) => product.name).join(", ")} isn't in stock on this floor.`
        : ""),
    actions: [
      {
        type: "directions",
        floorMapId: entry.floorMap._id,
        floorName: entry.floorMap.name,
        siteName: entry.site?.name ?? "",
        productIds: pickable,
        productNames,
      },
    ],
  };
}
