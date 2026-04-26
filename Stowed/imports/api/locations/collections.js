// imports/api/locations/collections.js
import { Mongo } from 'meteor/mongo';
import {
  SiteSchema,
  FloorMapSchema,
  StorageUnitSchema,
  StorageLocationSchema,
} from './schemas';

export const Sites = new Mongo.Collection('sites');
export const FloorMaps = new Mongo.Collection('floorMaps');
export const StorageUnits = new Mongo.Collection('storageUnits');
export const StorageLocations = new Mongo.Collection('storageLocations');

Sites.attachSchema(SiteSchema);
FloorMaps.attachSchema(FloorMapSchema);
StorageUnits.attachSchema(StorageUnitSchema);
StorageLocations.attachSchema(StorageLocationSchema);