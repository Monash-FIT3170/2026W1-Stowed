export function searchProducts(products, query) {
  if (!query || !query.trim()) return products;
  const q = query.toLowerCase();
  return products.filter((item) => {
    const name = (item.name || "").toLowerCase();
    const description = (item.description || "").toLowerCase();
    const sku = (item.sku || "").toLowerCase();
    const id = (item._id || "").toLowerCase();
    return name.includes(q) || description.includes(q) || sku.includes(q) || id.includes(q);
  });
}

// Low and out of stock are disjoint, matching the three states of StatusBadge:
// an item with nothing left reads as out of stock, not low.
export function filterLowStock(products) {
  return products.filter(
    (item) =>
      item.reorderAt != null && item.totalQuantity > 0 && item.totalQuantity <= item.reorderAt,
  );
}

export function filterOutOfStock(products) {
  return products.filter((item) => item.totalQuantity <= 0);
}

/**
 * Return low-stock products with the largest proportional shortage first.
 * This preserves filterLowStock as the single definition of low stock while
 * giving compact attention lists a deterministic urgency order.
 */
export function getLowStockProductsByUrgency(products) {
  return [...filterLowStock(products)].sort((a, b) => {
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
