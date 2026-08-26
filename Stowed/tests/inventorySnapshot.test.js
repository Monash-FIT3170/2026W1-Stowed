import assert from "assert";
import { getInventorySnapshot } from "../imports/api/inventorySnapshot";

describe("inventory snapshot", function () {
  it("summarises product quantities and the physical inventory footprint", function () {
    const result = getInventorySnapshot({
      products: [
        { _id: "product-1", totalQuantity: 10 },
        { _id: "product-2", totalQuantity: 2 },
      ],
      storageLocations: [{ _id: "location-1" }, { _id: "location-2" }],
      storageUnits: [{ _id: "unit-1" }],
    });

    assert.deepStrictEqual(result, {
      unitsOnHand: 12,
      productCount: 2,
      storageLocationCount: 2,
      storageUnitCount: 1,
    });
  });

  it("returns zero values for an empty organisation", function () {
    assert.deepStrictEqual(
      getInventorySnapshot({ products: [], storageLocations: [], storageUnits: [] }),
      {
        unitsOnHand: 0,
        productCount: 0,
        storageLocationCount: 0,
        storageUnitCount: 0,
      },
    );
  });
});
