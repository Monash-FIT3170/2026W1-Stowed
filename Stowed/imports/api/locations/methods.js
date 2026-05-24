// imports/api/locations/methods.js

import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "./collections";
import { ProductRecords } from "../products/collections";
import { getCallerOrgId, assertOrgAccess } from "../userMethods";

Meteor.methods({
  /**
   * Creates a new Site.
   */
  async "sites.create"({ name, description = "" }) {
    check(name, String);
    check(description, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const orgId = await getCallerOrgId(this.userId);
    if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

    return Sites.insertAsync({
      orgId,
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing Site.
   */
  async "sites.update"({ siteId, name, description = "" }) {
    check(siteId, String);
    check(name, String);
    check(description, String);

    await assertOrgAccess(Sites, siteId, this.userId);

    await Sites.updateAsync(siteId, {
      $set: { name, description, updatedAt: new Date() },
    });
  },

  /**
   * Deletes an existing Site when it has no child FloorMaps.
   */
  async "sites.delete"({ siteId }) {
    check(siteId, String);

    await assertOrgAccess(Sites, siteId, this.userId);

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
    floorSize = {},
    settings = {},
  }) {
    check(siteId, String);
    check(name, String);
    check(imageUrl, String);
    check(floorSize, Object);
    check(settings, Object);

    // assertOrgAccess covers both "site not found" and org ownership
    await assertOrgAccess(Sites, siteId, this.userId);

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
      throw new Meteor.Error(
        "floor-map-not-found",
        "No floor map found with that ID.",
      );
    }

    // Verify ownership via current parent site
    await assertOrgAccess(Sites, floorMap.siteId, this.userId);
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
      throw new Meteor.Error(
        "floor-map-not-found",
        "No floor map found with that ID.",
      );
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);

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
  async "storageUnits.create"({ floorMapId, name, type, position }) {
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(position, Object);

    // Prevent orphaned storage units by ensuring the parent FloorMap exists first.
    const floorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);

    const orgId = await getCallerOrgId(this.userId);

    return StorageUnits.insertAsync({
      orgId,
      floorMapId,
      name,
      type,
      position,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing StorageUnit.
   */
  async "storageUnits.update"({
    storageUnitId,
    floorMapId,
    name,
    type,
    position,
  }) {
    check(storageUnitId, String);
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(position, Object);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error(
        "storage-unit-not-found",
        "No storage unit found with that ID.",
      );
    }

    const currentFloorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!currentFloorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, currentFloorMap.siteId, this.userId);

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
      throw new Meteor.Error(
        "storage-unit-not-found",
        "No storage unit found with that ID.",
      );
    }

    const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);

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
  async "storageLocations.create"({
    storageUnitId,
    name,
    code,
    imageUrl = "",
  }) {
    check(storageUnitId, String);
    check(name, String);
    check(code, String);
    check(imageUrl, String);

    // Prevent orphaned storage locations by ensuring the parent StorageUnit exists first.
    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error(
        "invalid-storage-unit",
        "Storage unit does not exist.",
      );
    }

    const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);

    const orgId = await getCallerOrgId(this.userId);

    return StorageLocations.insertAsync({
      orgId,
      storageUnitId,
      name,
      code,
      imageUrl,
      storedItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing StorageLocation.
   */
  async "storageLocations.update"({
    storageLocationId,
    storageUnitId,
    name,
    code,
    imageUrl = "",
  }) {
    check(storageLocationId, String);
    check(storageUnitId, String);
    check(name, String);
    check(code, String);
    check(imageUrl, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const storageLocation =
      await StorageLocations.findOneAsync(storageLocationId);
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

    const storageLocation =
      await StorageLocations.findOneAsync(storageLocationId);
    if (!storageLocation) {
      throw new Meteor.Error(
        "storage-location-not-found",
        "No storage location found with that ID.",
      );
    }

    const storageUnit = await StorageUnits.findOneAsync(storageLocation.storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error(
        "invalid-storage-unit",
        "Storage unit does not exist.",
      );
    }

    const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
    if (!floorMap) {
      throw new Meteor.Error("invalid-floor-map", "Floor map does not exist.");
    }

    await assertOrgAccess(Sites, floorMap.siteId, this.userId);

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

    return StorageLocations.find(
      { storageUnitId },
      { sort: { code: 1 } },
    ).fetchAsync();
  },
});
