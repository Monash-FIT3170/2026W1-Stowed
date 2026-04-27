// imports/api/locations/schemas.js
import SimpleSchema from 'simpl-schema';

/**
 * Schema for a Site.
 *
 * A Site represents the highest-level physical storage area in the system.
 * Examples include a warehouse, office, shop, or home.
 */
export const SiteSchema = new SimpleSchema({
  name: {
    type: String,
    min: 1,
    max: 100,
  },

  description: {
    type: String,
    optional: true,
    max: 500,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});

/**
 * Schema for a FloorMap.
 *
 * A FloorMap belongs to a Site and represents a visual or logical layout
 * within that site. It may optionally reference an uploaded floor map image.
 */
export const FloorMapSchema = new SimpleSchema({
  siteId: String,
  name: {
    type: String,
    min: 1,
    max: 100,
  },
  imageUrl: {
    type: String,
    optional: true,
  },
  createdAt: Date,
  updatedAt: Date,
});

/**
 * Schema for a StorageUnit.
 *
 * A StorageUnit represents a physical storage structure on a FloorMap,
 * such as a shelf, cabinet, rack, drawer set, fridge, or other unit.
 *
 * The position field is used by the floor map UI to place and size the unit.
 */
export const StorageUnitSchema = new SimpleSchema({
  floorMapId: {
    type: String,
  },

  name: {
    type: String,
    min: 1,
    max: 100,
  },

  type: {
    type: String,
    allowedValues: ['shelf', 'cabinet', 'rack', 'drawer', 'fridge', 'other'],
  },
  
  position: {
    type: Object,
  },

  'position.x': {
    type: Number,
    min: 0,
  },

  'position.y': {
    type: Number,
    min: 0,
  },

  'position.width': {
    type: Number,
    min: 1,
  },

  'position.height': {
    type: Number,
    min: 1,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});

/**
 * Schema for a StorageLocation.
 *
 * A StorageLocation is the lowest-level fixed physical location where
 * products can later be assigned. For example, "Shelf A - Rack 1",
 * "Drawer 3", or "Bin 4".
 */
export const StorageLocationSchema = new SimpleSchema({
  storageUnitId: {
    type: String,
  },

  name: {
    type: String,
    min: 1,
    max: 100,
  },

  code: {
    type: String,
    min: 1,
    max: 50,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});