// imports/api/locations/methods.js

import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import { Sites, FloorMaps, StorageUnits, StorageLocations } from './collections';
import { ProductRecords } from '../products/collections';

Meteor.methods({
  /**
   * Creates a new Site.
   *
   * A Site represents the highest-level physical storage area, such as a
   * warehouse, office, shop, or home storage space.
   *
   * @param {Object} params
   * @param {string} params.name - Name of the site.
   * @param {string} [params.description=''] - Optional description of the site.
   * @returns {string} The ID of the created site document.
   *
   *
   * In development, unauthenticated access is allowed so the location UI can be
   * exercised without wiring a full auth flow first.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   */
  async 'sites.create'({ name, description = '' }) {
    check(name, String);
    check(description, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    return Sites.insertAsync({
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing Site.
   *
   * @param {Object} params
   * @param {string} params.siteId - ID of the site to update.
   * @param {string} params.name - Name of the site.
   * @param {string} [params.description=''] - Optional description of the site.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} site-not-found if no site exists for the provided ID.
   */
  async 'sites.update'({ siteId, name, description = '' }) {
    check(siteId, String);
    check(name, String);
    check(description, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const site = await Sites.findOneAsync(siteId);
    if (!site) {
      throw new Meteor.Error('site-not-found', 'No site found with that ID.');
    }

    await Sites.updateAsync(siteId, {
      $set: {
        name,
        description,
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Deletes an existing Site when it has no child FloorMaps.
   *
   * @param {Object} params
   * @param {string} params.siteId - ID of the site to delete.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} site-not-found if no site exists for the provided ID.
   * @throws {Meteor.Error} site-not-empty if the site still contains floor maps.
   */
  async 'sites.delete'({ siteId }) {
    check(siteId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const site = await Sites.findOneAsync(siteId);
    if (!site) {
      throw new Meteor.Error('site-not-found', 'No site found with that ID.');
    }

    const floorMap = await FloorMaps.findOneAsync({ siteId });
    if (floorMap) {
      throw new Meteor.Error('site-not-empty', 'Delete the site floor maps before deleting this site.');
    }

    await Sites.removeAsync(siteId);
  },

  /**
   * Creates a new FloorMap under an existing Site.
   *
   * A FloorMap represents a visual or logical layout within a Site. For example,
   * a site may have a ground floor, storage room, or warehouse zone.
   *
   * @param {Object} params
   * @param {string} params.siteId - ID of the parent Site.
   * @param {string} params.name - Name of the floor map.
   * @param {string} [params.imageUrl=''] - Optional URL/path for the floor map image.
   * @returns {string} The ID of the created floor map document.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} invalid-site if the parent Site does not exist.
   */
  async 'floorMaps.create'({ siteId, name, imageUrl = '', floorSize = {}, settings = {} }) {
    check(siteId, String);
    check(name, String);
    check(imageUrl, String);
    check(floorSize, Object);
    check(settings, Object);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    // Prevent orphaned floor maps by ensuring the parent Site exists first.
    const site = await Sites.findOneAsync(siteId);

    if (!site) {
      throw new Meteor.Error('invalid-site', 'Site does not exist.');
    }

    return FloorMaps.insertAsync({
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
   *
   * @param {Object} params
   * @param {string} params.floorMapId - ID of the floor map to update.
   * @param {string} params.siteId - ID of the parent Site.
   * @param {string} params.name - Name of the floor map.
   * @param {string} [params.imageUrl=''] - Optional URL/path for the floor map image.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} floor-map-not-found if no floor map exists for the provided ID.
   * @throws {Meteor.Error} invalid-site if the parent Site does not exist.
   */
  async 'floorMaps.update'({ floorMapId, siteId, name, imageUrl = '', floorSize = {}, settings = {} }) {
    check(floorMapId, String);
    check(siteId, String);
    check(name, String);
    check(imageUrl, String);
    check(floorSize, Object);
    check(settings, Object);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const floorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!floorMap) {
      throw new Meteor.Error('floor-map-not-found', 'No floor map found with that ID.');
    }

    const site = await Sites.findOneAsync(siteId);
    if (!site) {
      throw new Meteor.Error('invalid-site', 'Site does not exist.');
    }

    await FloorMaps.updateAsync(floorMapId, {
      $set: {
        siteId,
        name,
        imageUrl,
        floorSize,
        settings,
        updatedAt: new Date(),
      }
    });
  },

  /**
   * Deletes an existing FloorMap when it has no child StorageUnits.
   *
   * @param {Object} params
   * @param {string} params.floorMapId - ID of the floor map to delete.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} floor-map-not-found if no floor map exists for the provided ID.
   * @throws {Meteor.Error} floor-map-not-empty if the floor map still contains storage units.
   */
  async 'floorMaps.delete'({ floorMapId }) {
    check(floorMapId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const floorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!floorMap) {
      throw new Meteor.Error('floor-map-not-found', 'No floor map found with that ID.');
    }

    const storageUnit = await StorageUnits.findOneAsync({ floorMapId });
    if (storageUnit) {
      throw new Meteor.Error(
        'floor-map-not-empty',
        'Delete the floor map storage units before deleting this floor map.'
      );
    }

    await FloorMaps.removeAsync(floorMapId);
  },

  /**
   * Creates a new StorageUnit under an existing FloorMap.
   *
   * A StorageUnit represents a physical storage structure shown on the floor map,
   * such as a shelf, cabinet, rack, drawer set, fridge, or other storage unit.
   *
   * @param {Object} params
   * @param {string} params.floorMapId - ID of the parent FloorMap.
   * @param {string} params.name - Name of the storage unit.
   * @param {string} params.type - Type of storage unit.
   * @param {Object} params.position - Position and size of the unit on the map.
   * @param {number} params.position.x - X-coordinate on the floor map.
   * @param {number} params.position.y - Y-coordinate on the floor map.
   * @param {number} params.position.width - Width of the unit on the floor map.
   * @param {number} params.position.height - Height of the unit on the floor map.
   * @returns {string} The ID of the created storage unit document.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} invalid-floor-map if the parent FloorMap does not exist.
   */
  async 'storageUnits.create'({ floorMapId, name, type, position }) {
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(position, Object);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    // Prevent orphaned storage units by ensuring the parent FloorMap exists first.
    const floorMap = await FloorMaps.findOneAsync(floorMapId);

    if (!floorMap) {
      throw new Meteor.Error('invalid-floor-map', 'Floor map does not exist.');
    }

    return StorageUnits.insertAsync({
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
   *
   * @param {Object} params
   * @param {string} params.storageUnitId - ID of the storage unit to update.
   * @param {string} params.floorMapId - ID of the parent FloorMap.
   * @param {string} params.name - Name of the storage unit.
   * @param {string} params.type - Type of storage unit.
   * @param {Object} params.position - Position and size of the unit on the map.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} storage-unit-not-found if no storage unit exists for the provided ID.
   * @throws {Meteor.Error} invalid-floor-map if the parent FloorMap does not exist.
   */
  async 'storageUnits.update'({ storageUnitId, floorMapId, name, type, position }) {
    check(storageUnitId, String);
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(position, Object);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error('storage-unit-not-found', 'No storage unit found with that ID.');
    }

    const floorMap = await FloorMaps.findOneAsync(floorMapId);
    if (!floorMap) {
      throw new Meteor.Error('invalid-floor-map', 'Floor map does not exist.');
    }

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
   *
   * @param {Object} params
   * @param {string} params.storageUnitId - ID of the storage unit to delete.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} storage-unit-not-found if no storage unit exists for the provided ID.
   * @throws {Meteor.Error} storage-unit-not-empty if the storage unit still contains storage locations.
   */
  async 'storageUnits.delete'({ storageUnitId }) {
    check(storageUnitId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error('storage-unit-not-found', 'No storage unit found with that ID.');
    }

    const storageLocation = await StorageLocations.findOneAsync({ storageUnitId });
    if (storageLocation) {
      throw new Meteor.Error(
        'storage-unit-not-empty',
        'Delete the storage locations before deleting this storage unit.'
      );
    }

    await StorageUnits.removeAsync(storageUnitId);
  },

  /**
   * Creates a new StorageLocation under an existing StorageUnit.
   *
   * A StorageLocation is the lowest-level fixed physical location where products
   * can later be assigned. For example, "Shelf A - Rack 1" or "Drawer 3".
   *
   * @param {Object} params
   * @param {string} params.storageUnitId - ID of the parent StorageUnit.
   * @param {string} params.name - Display name of the storage location.
   * @param {string} params.code - Short unique/code-style label for the location.
   * @returns {string} The ID of the created storage location document.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} invalid-storage-unit if the parent StorageUnit does not exist.
   */
  async 'storageLocations.create'({
    storageUnitId,
    name,
    code,
    imageUrl = '',
  }) {
    check(storageUnitId, String);
    check(name, String);
    check(code, String);
    check(imageUrl, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    // Prevent orphaned storage locations by ensuring the parent StorageUnit exists first.
    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);

    if (!storageUnit) {
      throw new Meteor.Error('invalid-storage-unit', 'Storage unit does not exist.');
    }

    return StorageLocations.insertAsync({
      storageUnitId,
      name,
      code,
      imageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Updates an existing StorageLocation.
   *
   * @param {Object} params
   * @param {string} params.storageLocationId - ID of the storage location to update.
   * @param {string} params.storageUnitId - ID of the parent StorageUnit.
   * @param {string} params.name - Display name of the storage location.
   * @param {string} params.code - Short unique/code-style label for the location.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} storage-location-not-found if no storage location exists for the provided ID.
   * @throws {Meteor.Error} invalid-storage-unit if the parent StorageUnit does not exist.
   */
  async 'storageLocations.update'({
    storageLocationId,
    storageUnitId,
    name,
    code,
    imageUrl = '',
  }) {
    check(storageLocationId, String);
    check(storageUnitId, String);
    check(name, String);
    check(code, String);
    check(imageUrl, String);


    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const storageLocation = await StorageLocations.findOneAsync(storageLocationId);
    if (!storageLocation) {
      throw new Meteor.Error('storage-location-not-found', 'No storage location found with that ID.');
    }

    const storageUnit = await StorageUnits.findOneAsync(storageUnitId);
    if (!storageUnit) {
      throw new Meteor.Error('invalid-storage-unit', 'Storage unit does not exist.');
    }

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
   *
   * @param {Object} params
   * @param {string} params.storageLocationId - ID of the storage location to delete.
   *
   * @throws {Meteor.Error} not-authorised if the user is not logged in outside development.
   * @throws {Meteor.Error} storage-location-not-found if no storage location exists for the provided ID.
   * @throws {Meteor.Error} storage-location-in-use if products are still assigned to the storage location.
   */
  async 'storageLocations.delete'({ storageLocationId }) {
    check(storageLocationId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const storageLocation = await StorageLocations.findOneAsync(storageLocationId);
    if (!storageLocation) {
      throw new Meteor.Error('storage-location-not-found', 'No storage location found with that ID.');
    }

    const productRecord = await ProductRecords.findOneAsync({ locationId: storageLocationId });
    if (productRecord) {
      throw new Meteor.Error(
        'storage-location-in-use',
        'Move or remove the products in this location before deleting it.'
      );
    }

    await StorageLocations.removeAsync(storageLocationId);
  },

  async 'storageLocations.getByStorageUnit'({ storageUnitId }) {
    check(storageUnitId, String);

    return StorageLocations.find(
      { storageUnitId },
      { sort: { code: 1 } }
    ).fetchAsync();
  },
});
