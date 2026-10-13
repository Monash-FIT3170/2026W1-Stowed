// imports/api/locations/collections.js
import { Mongo } from "meteor/mongo";
import "meteor/aldeed:collection2/static";

import {
  SiteSchema,
  FloorMapSchema,
  StorageUnitSchema,
  UnitShapeSchema,
  StorageLocationSchema,
  FloorMapRouteSchema,
} from "./schemas";

/**
 * Stores high-level physical storage areas.
 */
export const Sites = new Mongo.Collection("sites");

/**
 * Stores floor maps that belong to a Site.
 */
export const FloorMaps = new Mongo.Collection("floorMaps");

/**
 * Stores physical storage units that belong to a FloorMap.
 */
export const StorageUnits = new Mongo.Collection("storageUnits");

/**
 * Stores default and customer shape objects available in the Floor Map Editor
 */
export const MapShapes = new Mongo.Collection("mapShapes");

/**
 * Stores fixed storage locations within a StorageUnit.
 */
export const StorageLocations = new Mongo.Collection("storageLocations");

/**
 * Stores the walkway route graph (nodes and links) for a FloorMap - one document per FloorMap.
 */
export const FloorMapRoutes = new Mongo.Collection("floorMapRoutes");

Sites.attachSchema(SiteSchema);
FloorMaps.attachSchema(FloorMapSchema);
StorageUnits.attachSchema(StorageUnitSchema);
MapShapes.attachSchema(UnitShapeSchema);
StorageLocations.attachSchema(StorageLocationSchema);
FloorMapRoutes.attachSchema(FloorMapRouteSchema);
