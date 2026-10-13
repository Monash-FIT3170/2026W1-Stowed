import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import {
  FloorMaps,
  FloorMapRoutes,
  StorageLocations,
  StorageUnits,
} from "/imports/api/locations/collections";
import { ProductRecords } from "/imports/api/products/collections";
import { assertOrgAccess, requirePermission } from "/imports/api/userMethods";
import { planRoute } from "./planRoute";

Meteor.methods({
  /**
   * Plans a picking route on a floor map's saved walkway graph, from `start` (metres)
   * to a storage location holding stock of each requested product. See `planRoute()`
   * for the shape of the result.
   */
  async "floorMapRoutes.generate"({ floorMapId, start, productIds }) {
    check(floorMapId, String);
    check(start, { x: Number, y: Number });
    check(productIds, [String]);

    await assertOrgAccess(FloorMaps, floorMapId, this.userId);
    await requirePermission(this.userId, "floorMapRoutes.generate");

    if (productIds.length === 0) {
      throw new Meteor.Error("invalid-route-request", "Select at least one product.");
    }

    const route = await FloorMapRoutes.findOneAsync({ floorMapId });
    if (!route || route.nodes.length === 0) {
      throw new Meteor.Error(
        "no-route",
        "This floor map has no walkways yet. Add them in Route mode first.",
      );
    }

    // Storage locations on this floor map that hold stock of each requested product
    const unitIds = (
      await StorageUnits.find({ floorMapId }, { fields: { _id: 1 } }).fetchAsync()
    ).map((unit) => unit._id);
    const locationIds = (
      await StorageLocations.find(
        { storageUnitId: { $in: unitIds } },
        { fields: { _id: 1 } },
      ).fetchAsync()
    ).map((location) => location._id);
    const records = await ProductRecords.find(
      { productId: { $in: productIds }, locationId: { $in: locationIds }, quantity: { $gt: 0 } },
      { fields: { productId: 1, locationId: 1 } },
    ).fetchAsync();

    const locationIdsByProduct = new Map(productIds.map((productId) => [productId, []]));
    for (const record of records) {
      locationIdsByProduct.get(record.productId).push(record.locationId);
    }

    return planRoute(route, start, locationIdsByProduct);
  },
});
