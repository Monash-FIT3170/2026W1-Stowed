// imports/api/locations/methods.js

import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from './collections';

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
   * @throws {Meteor.Error} not-authorised if the user is not logged in.
   */
  'sites.create'({ name, description = '' }) {
    check(name, String);
    check(description, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    return Sites.insert({
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
   * @throws {Meteor.Error} not-authorised if the user is not logged in.
   * @throws {Meteor.Error} invalid-site if the parent Site does not exist.
   */
  'floorMaps.create'({ siteId, name, imageUrl = '' }) {
    check(siteId, String);
    check(name, String);
    check(imageUrl, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    // Prevent orphaned floor maps by ensuring the parent Site exists first.
    const site = Sites.findOne(siteId);

    if (!site) {
      throw new Meteor.Error('invalid-site', 'Site does not exist.');
    }

    return FloorMaps.insert({
      siteId,
      name,
      imageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
   * @throws {Meteor.Error} not-authorised if the user is not logged in.
   * @throws {Meteor.Error} invalid-floor-map if the parent FloorMap does not exist.
   */
  'storageUnits.create'({ floorMapId, name, type, position }) {
    check(floorMapId, String);
    check(name, String);
    check(type, String);
    check(position, Object);

    if (!this.userId) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    // Prevent orphaned storage units by ensuring the parent FloorMap exists first.
    const floorMap = FloorMaps.findOne(floorMapId);

    if (!floorMap) {
      throw new Meteor.Error('invalid-floor-map', 'Floor map does not exist.');
    }

    return StorageUnits.insert({
      floorMapId,
      name,
      type,
      position,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
   * @throws {Meteor.Error} not-authorised if the user is not logged in.
   * @throws {Meteor.Error} invalid-storage-unit if the parent StorageUnit does not exist.
   */
  'storageLocations.create'({ storageUnitId, name, code }) {
    check(storageUnitId, String);
    check(name, String);
    check(code, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    // Prevent orphaned storage locations by ensuring the parent StorageUnit exists first.
    const storageUnit = StorageUnits.findOne(storageUnitId);

    if (!storageUnit) {
      throw new Meteor.Error('invalid-storage-unit', 'Storage unit does not exist.');
    }

    return StorageLocations.insert({
      storageUnitId,
      name,
      code,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },
});