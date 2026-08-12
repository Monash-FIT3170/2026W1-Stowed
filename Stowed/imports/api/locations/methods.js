// imports/api/locations/methods.js

// TODO:
//  - add attributes to storageLocaitons
//  - remove attributes from productRecord
//  - update main server file to refelct changes

import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import { Sites, FloorMaps, StorageUnits, StorageLocations } from "./collections";
import { ProductRecords } from "../products/collections";
import { getCallerOrgId, assertOrgAccess, requirePermission } from "../userMethods";
import { DEFAULT_STOCKTAKE_INTERVAL_DAYS, isValidStocktakeInterval } from "./stocktake";

Meteor.methods({
  /**
   * Updates the stocktake schedule for one Site and immediately refreshes the
   * cached due flags for every location below it.
   */
  async "sites.updateStocktakeInterval"({ siteId, intervalDays }) {
    check(siteId, String);
    check(intervalDays, Number);

    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) {
      throw new Meteor.Error(
        "invalid-stocktake-interval",
        "The stocktake interval must be a whole number between 1 and 3650 days.",
      );
    }

    await assertOrgAccess(Sites, siteId, this.userId);
    await requirePermission(this.userId, "settings.manage");

    const now = new Date();
    await Sites.updateAsync(siteId, {
      $set: { stocktakeIntervalDays: intervalDays, updatedAt: now },
    });

    const floorMapIds = (await FloorMaps.find({ siteId }, { fields: { _id: 1 } }).fetchAsync()).map(
      (floorMap) => floorMap._id,
    );
    const storageUnitIds = (
      await StorageUnits.find(
        { floorMapId: { $in: floorMapIds } },
        { fields: { _id: 1 } },
      ).fetchAsync()
    ).map((storageUnit) => storageUnit._id);
    const locations = await StorageLocations.find(
      { storageUnitId: { $in: storageUnitIds } },
      { fields: { _id: 1 } },
    ).fetchAsync();

    return { siteId, intervalDays, locationsChecked: locations.length };
  },

  /**
   * Creates a new Site.
   */
  async "sites.create"({
    name,
    description = "",
    stocktakeIntervalDays = DEFAULT_STOCKTAKE_INTERVAL_DAYS,
  }) {
    check(name, String);
    check(description, String);
    check(stocktakeIntervalDays, Number);

    if (!isValidStocktakeInterval(stocktakeIntervalDays)) {
      throw new Meteor.Error(
        "invalid-stocktake-interval",
        "The stocktake interval must be a whole number between 1 and 3650 days.",
      );
    }

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await requirePermission(this.userId, "locations.manage");

    const orgId = await getCallerOrgId(this.userId);
    if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

    return Sites.insertAsync({
      orgId,
      name,
      description,
      stocktakeIntervalDays,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing Site.
   */
  async "sites.update"({ siteId, name, description = "", stocktakeIntervalDays }) {
    check(siteId, String);
    check(name, String);
    check(description, String);
    check(stocktakeIntervalDays, Number);

    if (!isValidStocktakeInterval(stocktakeIntervalDays)) {
      throw new Meteor.Error(
        "invalid-stocktake-interval",
        "The stocktake interval must be a whole number between 1 and 3650 days.",
      );
    }

    await assertOrgAccess(Sites, siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    await Sites.updateAsync(siteId, {
      $set: { name, description, stocktakeIntervalDays, updatedAt: new Date() },
    });
  },

  /**
   * Deletes an existing Site when it has no child FloorMaps.
   */
  async "sites.delete"({ siteId }) {
    check(siteId, String);

    await assertOrgAccess(Sites, siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    const floorMap = await FloorMaps.findOneAsync({ siteId });
    if (floorMap) {
      throw new Meteor.Error(
        "site-not-empty",
        "Delete the site floor maps before deleting this site.",
      );
    }

    await Sites.removeAsync(siteId);
  },

  /**
   * Creates a new FloorMap under an existing Site.
   */
  async "floorMaps.create"({
    siteId,
    name,
    imageUrl = "",
    floorSize = { width: 500, height: 500 },
    settings = {},
  }) {
    check(siteId, String);
    check(name, String);
    check(imageUrl, String);
    check(floorSize, Object);
    check(settings, Object);

    // assertOrgAccess covers both "site not found" and org ownership
    await assertOrgAccess(Sites, siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    const orgId = await getCallerOrgId(this.userId);

    return FloorMaps.insertAsync({
      orgId,
      siteId,
      name,
      imageUrl,
      floorSize,
      settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing FloorMap.
   */
  async "floorMaps.update"({
    floorMapId,
    siteId,
    name,
    imageUrl = "",
    floorSize = {},
    settings = {},
  }) {
    check(floorMapId, String);
    check(siteId, String);
    check(name, String);
    check(imageUrl, String);
    check(floorSize, Object);
    check(settings, Object);

    const floorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("floor-map-not-found", "No floor map found with that ID.");
    }

    // Verify ownership via current parent site
    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");
    // Verify new parent site also belongs to same org (covers "site not found" too)
    await assertOrgAccess(Sites, siteId, this.userId);

    await FloorMaps.updateAsync(floorMapId, {
      $set: {
        siteId,
        name,
        imageUrl,
        floorSize,
        settings,
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Deletes an existing FloorMap when it has no child StorageUnits.
   */
  async "floorMaps.delete"({ floorMapId }) {
    check(floorMapId, String);

    const floorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("floor-map-not-found", "No floor map found with that ID.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    const storageUnit = await StorageUnits.findOneAsync({ floorMapId });
    if (storageUnit) {
      throw new Meteor.Error(
        "floor-map-not-empty",
        "Delete the floor map storage units before deleting this floor map.",
      );
    }

    await FloorMaps.removeAsync(floorMapId);
  },

  /**
   * Creates a new StorageUnit under an existing FloorMap.
   */
  async "storageUnits.create"({ floorMapId, name, type, position, fill }) {
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(position, Object);
    if (fill !== undefined) check(fill, String);

    // Prevent orphaned storage units by ensuring the parent FloorMap exists first.
    const floorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    const orgId = await getCallerOrgId(this.userId);

    return StorageUnits.insertAsync({
      orgId,
      floorMapId,
      name,
      type,
      position,
      ...(fill !== undefined ? { fill } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing StorageUnit.
   */
  async "storageUnits.update"({ storageUnitId, floorMapId, name, type, position, fill }) {
    check(storageUnitId, String);
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(position, Object);
    if (fill !== undefined) check(fill, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error("storage-unit-not-found", "No storage unit found with that ID.");
    }

    const currentFloorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!currentFloorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, currentFloorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    // Verify new parent floor map also belongs to same org
    const newFloorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!newFloorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }
    await assertOrgAccess(Sites, newFloorMap.siteId, this.userId);

    await StorageUnits.updateAsync(storageUnitId, {
      $set: {
        floorMapId,
        name,
        type,
        position,
        ...(fill !== undefined ? { fill } : {}),
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Deletes an existing StorageUnit when it has no child StorageLocations.
   */
  async "storageUnits.delete"({ storageUnitId }) {
    check(storageUnitId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error("storage-unit-not-found", "No storage unit found with that ID.");
    }

    const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    const storageLocation = await StorageLocations.findOneAsync({
      storageUnitId,
    });
    if (storageLocation) {
      throw new Meteor.Error(
        "storage-unit-not-empty",
        "Delete the storage locations before deleting this storage unit.",
      );
    }

    await StorageUnits.removeAsync(storageUnitId);
  },

  /**
   * Creates a new StorageLocation under an existing StorageUnit.
   */
  async "storageLocations.create"({ storageUnitId, name, code, imageUrl = "" }) {
    check(storageUnitId, String);
    check(name, String);
    check(code, String);
    check(imageUrl, String);

    // Prevent orphaned storage locations by ensuring the parent StorageUnit exists first.
    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error("invalid-storage-unit", "Storage unit does not exist.");
    }

    const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    const orgId = await getCallerOrgId(this.userId);

    const now = new Date();

    return StorageLocations.insertAsync({
      orgId,
      storageUnitId,
      name,
      code,
      imageUrl,
      storedItems: [],
      lastStocktakeAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Updates an existing StorageLocation.
   */
  async "storageLocations.update"({ storageLocationId, storageUnitId, name, code, imageUrl = "" }) {
    check(storageLocationId, String);
    check(storageUnitId, String);
    check(name, String);
    check(code, String);
    check(imageUrl, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const storageLocation = await StorageLocations.findOneAsync(storageLocationId);
    if (!storageLocation) {
      throw new Meteor.Error(
        "storage-location-not-found",
        "No storage location found with that ID.",
      );
    }

    const currentStorageUnit = await StorageUnits.findOneAsync(storageLocation.storageUnitId);
    if (!currentStorageUnit) {
      throw new Meteor.Error("invalid-storage-unit", "Storage unit does not exist.");
    }

    const floorMap = await FloorMaps.findOneAsync(currentStorageUnit.floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    // Verify new parent storage unit also belongs to same org
    const newStorageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!newStorageUnit) {
      throw new Meteor.Error("invalid-storage-unit", "Storage unit does not exist.");
    }
    const newFloorMap = await FloorMaps.findOneAsync(newStorageUnit.floorMapId);
    if (!newFloorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }
    await assertOrgAccess(Sites, newFloorMap.siteId, this.userId);

    await StorageLocations.updateAsync(storageLocationId, {
      $set: {
        storageUnitId,
        name,
        code,
        imageUrl,
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Deletes an existing StorageLocation when no ProductRecords still reference it.
   */
  async "storageLocations.delete"({ storageLocationId }) {
    check(storageLocationId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const storageLocation = await StorageLocations.findOneAsync(storageLocationId);
    if (!storageLocation) {
      throw new Meteor.Error(
        "storage-location-not-found",
        "No storage location found with that ID.",
      );
    }

    const storageUnit = await StorageUnits.findOneAsync(storageLocation.storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error("invalid-storage-unit", "Storage unit does not exist.");
    }

    const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
    await requirePermission(this.userId, "locations.manage");

    const productRecord = await ProductRecords.findOneAsync({
      locationId: storageLocationId,
    });
    if (productRecord) {
      throw new Meteor.Error(
        "storage-location-in-use",
        "Move or remove the products in this location before deleting it.",
      );
    }

    await StorageLocations.removeAsync(storageLocationId);
  },

  async "storageLocations.getByStorageUnit"({ storageUnitId }) {
    check(storageUnitId, String);

    return StorageLocations.find({ storageUnitId }, { sort: { code: 1 } }).fetchAsync();
  },

  /**
   *
   * Updates StorageLocation attributes when a stocktake has been completed for an item in a specific location
   *
   * This method sets the completion timestamp.
   *
   */
  async "storageLocations.stocktakeComplete"({ locationId }) {
    check(locationId, String);

    await StorageLocations.updateAsync(locationId, {
      $set: {
        lastStocktakeAt: new Date(),
      },
    });
  },
});
