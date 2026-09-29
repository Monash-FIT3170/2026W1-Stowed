import { STOCK_STATUS, getStockStatus, filterByCategory } from "../products/filters";

/**
 * Customer catalogue helpers
 *
 * The shopper-facing view of a product, plus the search, filter and sort the
 * customer search page runs over it. Free of Meteor imports so the server
 * methods can build the shape and the client and tests can work on it alike.
 * Search and the category filter are the shared ones from products/filters.
 *
 * A customer sees what helps them buy and find an item - never what the store
 * paid, how many it holds, when it reorders, or any staff audit fields. The
 * shape below is a whitelist: a field added to Products later stays private
 * until someone adds it here on purpose.
 */

export const CUSTOMER_SORTS = [
  { id: "name-asc", label: "Name: A to Z" },
  { id: "name-desc", label: "Name: Z to A" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "availability", label: "Availability" },
];

export const DEFAULT_CUSTOMER_SORT = "name-asc";

const CUSTOMER_SORT_IDS = new Set(CUSTOMER_SORTS.map((sort) => sort.id));

export function isCustomerSort(sortKey) {
  return CUSTOMER_SORT_IDS.has(sortKey);
}

const AVAILABILITY_RANK = {
  [STOCK_STATUS.IN]: 0,
  [STOCK_STATUS.LOW]: 1,
  [STOCK_STATUS.OUT]: 2,
};

/**
 * Where each product sits in the store, keyed by product id: the locations
 * that actually hold some of it, the fullest first, labelled "Unit · Shelf"
 * as on the staff inventory list. Quantities are used to order the list and
 * then dropped, so none reach the customer.
 */
export function buildLocationsByProductId(productRecords, storageLocations, storageUnits) {
  const locationById = new Map(storageLocations.map((loc) => [loc._id, loc]));
  const unitById = new Map(storageUnits.map((unit) => [unit._id, unit]));

  const ranked = new Map();
  for (const record of productRecords) {
    if (!(record.quantity > 0)) continue;
    const loc = locationById.get(record.locationId);
    if (!loc) continue;
    const unit = unitById.get(loc.storageUnitId);
    const label = [unit?.name, loc.name].filter(Boolean).join(" · ");
    if (!label) continue;

    if (!ranked.has(record.productId)) ranked.set(record.productId, []);
    ranked.get(record.productId).push({
      unitId: unit ? unit._id : null,
      label,
      quantity: record.quantity,
    });
  }

  const result = new Map();
  for (const [productId, locations] of ranked) {
    result.set(
      productId,
      locations
        .sort((a, b) => b.quantity - a.quantity)
        .map(({ unitId, label }) => ({ unitId, label })),
    );
  }
  return result;
}

export function toCustomerProduct(product, { categoryNameById, locationsByProductId }) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const categoryId = product.categoryId || null;

  return {
    _id: product._id,
    name: product.name,
    description: product.description || "",
    brand: product.brand || "",
    categoryId,
    categoryName: (categoryId && categoryNameById.get(categoryId)) || "",
    // unitCost is the shelf price (the add-product lookup fills it from the
    // retailer's sell price); purchaseCost is what the store paid and stays out.
    price: typeof product.unitCost === "number" ? product.unitCost : null,
    images,
    stockStatus: getStockStatus(product.totalQuantity, product.reorderAt ?? null),
    locations: locationsByProductId.get(product._id) ?? [],
  };
}

/**
 * What a shopper would type, for the shared searchProducts: the name, brand,
 * description or category. Ids and SKUs are left out - a customer never sees
 * them, so a hit on one would look like a false match.
 */
export const CUSTOMER_SEARCH_FIELDS = ["name", "brand", "description", "categoryName"];

export function filterCustomerProducts(items, { status, categoryId, unitId } = {}) {
  return filterByCategory(items, categoryId).filter(
    (item) =>
      (!status || item.stockStatus === status) &&
      (!unitId || item.locations.some((loc) => loc.unitId === unitId)),
  );
}

const byName = (a, b) => (a.name || "").localeCompare(b.name || "");

// Unpriced items go last in both price orders, rather than reading as free.
function byPrice(direction) {
  return (a, b) => {
    if (a.price == null || b.price == null) {
      if (a.price == null && b.price == null) return byName(a, b);
      return a.price == null ? 1 : -1;
    }
    return (a.price - b.price) * direction || byName(a, b);
  };
}

const COMPARATORS = {
  "name-asc": byName,
  "name-desc": (a, b) => byName(b, a),
  "price-asc": byPrice(1),
  "price-desc": byPrice(-1),
  availability: (a, b) =>
    AVAILABILITY_RANK[a.stockStatus] - AVAILABILITY_RANK[b.stockStatus] || byName(a, b),
};

export function sortCustomerProducts(items, sortKey) {
  const compare = COMPARATORS[sortKey] ?? COMPARATORS[DEFAULT_CUSTOMER_SORT];
  return [...items].sort(compare);
}
