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

export function filterLowStock(products) {
  return products.filter(
    (item) => item.reorderAt != null && item.totalQuantity <= item.reorderAt
  );
}

export function filterByStorageUnit(products, productRecords, storageLocations, unitId) {
  if (!unitId) return products;
  const unitLocationIds = new Set(
    storageLocations.filter((l) => l.storageUnitId === unitId).map((l) => l._id)
  );
  const productIdsInUnit = new Set(
    productRecords.filter((r) => unitLocationIds.has(r.locationId)).map((r) => r.productId)
  );
  return products.filter((item) => productIdsInUnit.has(item._id));
}