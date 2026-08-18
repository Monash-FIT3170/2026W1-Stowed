// imports/api/locations/methods.js

import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import { Sites, FloorMaps, StorageUnits, MapShapes, StorageLocations } from "./collections";
import { ProductRecords } from "../products/collections";
import { getCallerOrgId, assertOrgAccess, requirePermission } from "../userMethods";
import { DEFAULT_STOCKTAKE_INTERVAL_DAYS, isValidStocktakeInterval } from "./stocktake";

import { isSimple, makeCCW, removeCollinearPoints } from "poly-decomp-es";

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
  async "storageUnits.create"({ floorMapId, name, type, shape, offset, rotation, scale, fill }) {
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(shape, Object);
    check(offset, Object);
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
      shape: { ...shape, orgId },
      offset,
      rotation,
      scale,
      ...(fill !== undefined ? { fill } : {}),
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
    shape,
    offset,
    rotation,
    scale,
    fill,
  }) {
    check(storageUnitId, String);
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(shape, Object);
    check(offset, Object);
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

    // Fetch orgID from server to attach to shape
    const orgId = await getCallerOrgId(this.userId);

    await StorageUnits.updateAsync(storageUnitId, {
      $set: {
        floorMapId,
        name,
        type,
        shape: { ...shape, orgId },
        offset,
        rotation,
        scale,
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
   * Creates a new shape object
   */
  async "mapShapes.create"({ name, points, gridReference = { x: 0, y: 0 } }) {
    // validate inputs
    check(name, String);
    check(points, Array);
    points.forEach((p) => check(p, { x: Number, y: Number }));
    check(gridReference, { x: Number, y: Number });

    // check user permissions
    if (!this.userId) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    } else if (!Meteor.isDevelopment) {
      await requirePermission(this.userId, "locations.manage");
    }

    // build calculated values
    // Organisation ID
    const orgId = await getCallerOrgId(this.userId);
    if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

    // width and height
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0)
      throw new Meteor.Error(
        "invalid-shape-width",
        `The width of the shape must be >0 but got "${width}"`,
      );
    if (height <= 0)
      throw new Meteor.Error(
        "invalid-shape-height",
        `The height of the shape must be >0 but got "${height}"`,
      );

    // shapeId
    const lastId = await MapShapes.rawCollection()
      .aggregate([
        {
          $group: {
            _id: null,
            maxVal: { $max: "$shapeId" },
          },
        },
      ])
      .toArray();
    const shapeId = lastId.length > 0 ? lastId[0].maxVal + 1 : 0;

    // Check unique name (within organisation) - case-sensitive
    const existing = await MapShapes.findOneAsync({
      orgId,
      name,
    });
    if (existing) {
      throw new Meteor.Error("duplicate-name", `A shape named "${name}" already exists.`);
    }

    // Check if shape has any intersecting lines
    const polygon = points.map((p) => [p.x, p.y]);
    if (!isSimple(polygon)) {
      throw new Meteor.Error("intersecting-lines", `The shape has intersecting lines.`);
    }

    // Remove redundant vertices that are close to eachother or in the line of antoher
    removeCollinearPoints(polygon, 0.01);
    // Ensure polygon follows CCW conventions
    makeCCW(polygon);

    // Convert polygon tuples back to {x,y} objects for db
    const cleaned = polygon.map(([x, y]) => ({ x, y }));

    return MapShapes.insertAsync({
      orgId,
      shapeId,
      name,
      points: cleaned,
      gridReference: gridReference,
    });
  },

  /**
   * Updates an existing shape object
   */
  async "mapShapes.update"({ orgId, shapeId, name, points, gridReference = { x: 0, y: 0 } }) {
    // validate inputs
    check(orgId, String);
    check(shapeId, Number);
    check(name, String);
    check(points, Array);
    points.forEach((p) => check(p, { x: Number, y: Number }));
    check(gridReference, { x: Number, y: Number });

    // check user permissions
    if (!this.userId) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    } else if (!Meteor.isDevelopment) {
      await requirePermission(this.userId, "locations.manage");
    }

    // build calculated values

    // width and height
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0)
      throw new Meteor.Error(
        "invalid-shape-width",
        `The width of the shape must be >0 but got "${width}"`,
      );
    if (height <= 0)
      throw new Meteor.Error(
        "invalid-shape-height",
        `The height of the shape must be >0 but got "${height}"`,
      );

    // Check unique name (within organisation) - case-sensitive, excluding this shape itself
    const existing = await MapShapes.findOneAsync({
      orgId,
      name,
      shapeId: { $ne: shapeId },
    });
    if (existing) {
      throw new Meteor.Error("duplicate-name", `A shape named "${name}" already exists.`);
    }

    // Check if shape has any intersecting lines
    const polygon = points.map((p) => [p.x, p.y]);
    if (!isSimple(polygon)) {
      throw new Meteor.Error("intersecting-lines", `The shape has intersecting lines.`);
    }

    // Remove redundant vertices that are close to eachother or in the line of antoher
    removeCollinearPoints(polygon, 0.01);
    // Ensure polygon follows CCW conventions
    makeCCW(polygon);

    // Convert polygon tuples back to {x,y} objects for db
    const cleaned = polygon.map(([x, y]) => ({ x, y }));

    return MapShapes.updateAsync(
      { shapeId },
      {
        $set: {
          orgId: orgId,
          name: name,
          points: cleaned,
          gridReference: gridReference,
        },
      },
    );
  },

  /**
   * Deletes a shape from the database
   */
  async "mapShapes.delete"({ shapeId }) {
    check(shapeId, Number);

    // check user permissions
    if (!this.userId) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    } else if (!Meteor.isDevelopment) {
      await requirePermission(this.userId, "locations.manage");
    }

    const shape = await MapShapes.findOneAsync({ shapeId: shapeId });
    if (!shape) {
      throw new Meteor.Error("shape-not-found", "No shape found with that name.");
    }

    await MapShapes.removeAsync({ shapeId: shapeId });
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

  /**
   * Retrieves a storage unit as identified by its ID
   */
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
