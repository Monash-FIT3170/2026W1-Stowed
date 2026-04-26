// imports/api/locations/collections.js
import { Mongo } from 'meteor/mongo';
import 'meteor/aldeed:collection2/static';

import {
  SiteSchema,
  FloorMapSchema,
  StorageUnitSchema,
  StorageLocationSchema,
} from './schemas';

/**
 * Stores high-level physical storage areas.
 */
export const Sites = new Mongo.Collection('sites');

/**
 * Stores floor maps that belong to a Site.
 */
export const FloorMaps = new Mongo.Collection('floorMaps');

/**
 * Stores physical storage units that belong to a FloorMap.
 */
export const StorageUnits = new Mongo.Collection('storageUnits');

/**
 * Stores fixed storage locations within a StorageUnit.
 */
export const StorageLocations = new Mongo.Collection('storageLocations');

Sites.attachSchema(SiteSchema);
FloorMaps.attachSchema(FloorMapSchema);
StorageUnits.attachSchema(StorageUnitSchema);
StorageLocations.attachSchema(StorageLocationSchema);