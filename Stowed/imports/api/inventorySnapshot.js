export function getInventorySnapshot({ products, storageLocations, storageUnits }) {
  return {
    unitsOnHand: products.reduce(
      (total, product) =>
        total + (Number.isFinite(product.totalQuantity) ? product.totalQuantity : 0),
      0,
    ),
    productCount: products.length,
    storageLocationCount: storageLocations.length,
    storageUnitCount: storageUnits.length,
  };
}
