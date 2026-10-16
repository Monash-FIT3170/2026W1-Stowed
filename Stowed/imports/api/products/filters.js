// The staff inventory searches identifiers too; the customer catalogue passes
// its own fields, since a shopper never sees an id or SKU to type in.
export const STAFF_SEARCH_FIELDS = ["name", "description", "sku", "_id"];

export function searchProducts(products, query, fields = STAFF_SEARCH_FIELDS) {
  if (!query || !query.trim()) return products;
  const q = query.toLowerCase();
  return products.filter((item) =>
    fields.some((field) => (item[field] || "").toLowerCase().includes(q)),
  );
}

export const STOCK_STATUS = {
  IN: "in-stock",
  LOW: "low-stock",
  OUT: "out-of-stock",
};

// The three states behind StatusBadge and the low/out filters below: out of
// stock at zero, low at or below the reorder threshold, in stock otherwise. An
// item with no threshold can only be out of stock or in stock.
export function getStockStatus(quantity, threshold) {
  if (quantity <= 0) return STOCK_STATUS.OUT;
  if (threshold != null && quantity <= threshold) return STOCK_STATUS.LOW;
  return STOCK_STATUS.IN;
}

// Low and out of stock are disjoint, matching the three states of StatusBadge:
// an item with nothing left reads as out of stock, not low.
export function filterByStockStatus(products, status) {
  return products.filter(
    (item) => getStockStatus(item.totalQuantity, item.reorderAt ?? null) === status,
  );
}

export function filterLowStock(products) {
  return filterByStockStatus(products, STOCK_STATUS.LOW);
}

export function filterOutOfStock(products) {
  return filterByStockStatus(products, STOCK_STATUS.OUT);
}

// Everything at or below its reorder point, out of stock included: the set the
// dashboard means by "needs attention". Deliberately wider than filterLowStock,
// which excludes items with nothing left because the inventory chips show those
// under their own filter.
export function filterNeedsReorder(products) {
  return products.filter((item) => item.reorderAt != null && item.totalQuantity <= item.reorderAt);
}

/**
 * Return everything at or below its reorder point with the largest proportional
 * shortage first, so compact attention lists have a deterministic urgency order.
 * Out-of-stock items rank highest, being the most urgent of all.
 */
export function getLowStockProductsByUrgency(products) {
  return [...filterNeedsReorder(products)].sort((a, b) => {
    const aShortage = a.reorderAt - a.totalQuantity;
    const bShortage = b.reorderAt - b.totalQuantity;
    const aShortageRatio = a.reorderAt > 0 ? aShortage / a.reorderAt : 0;
    const bShortageRatio = b.reorderAt > 0 ? bShortage / b.reorderAt : 0;

    if (aShortageRatio !== bShortageRatio) return bShortageRatio - aShortageRatio;
    if (aShortage !== bShortage) return bShortage - aShortage;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

export function getRecentlyUpdatedProducts(products, limit = 5) {
  return [...products]
    .sort((a, b) => {
      const aUpdatedAt = new Date(a.updatedAt).getTime();
      const bUpdatedAt = new Date(b.updatedAt).getTime();
      const aTimestamp = Number.isNaN(aUpdatedAt) ? Number.NEGATIVE_INFINITY : aUpdatedAt;
      const bTimestamp = Number.isNaN(bUpdatedAt) ? Number.NEGATIVE_INFINITY : bUpdatedAt;
      return bTimestamp - aTimestamp;
    })
    .slice(0, Math.max(0, limit));
}

export function filterByStorageUnit(products, productRecords, storageLocations, unitId) {
  if (!unitId) return products;
  const unitLocationIds = new Set(
    storageLocations.filter((l) => l.storageUnitId === unitId).map((l) => l._id),
  );
  const productIdsInUnit = new Set(
    productRecords.filter((r) => unitLocationIds.has(r.locationId)).map((r) => r.productId),
  );
  return products.filter((item) => productIdsInUnit.has(item._id));
}

export function filterByCategory(products, categoryId) {
  if (!categoryId) return products;
  return products.filter((item) => item.categoryId === categoryId);
}
