// imports/api/locations/schemas.js
import SimpleSchema from "simpl-schema";

/**
 * Schema for a Site.
 */
export const SiteSchema = new SimpleSchema({
  orgId: {
    type: String,
  },

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

  // How many days may pass before a storage location in this site is due for
  // its next stocktake. Defaults to roughly six months.
  stocktakeIntervalDays: {
    type: SimpleSchema.Integer,
    min: 1,
    defaultValue: 180,
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
 */
export const FloorMapSchema = new SimpleSchema({
  orgId: String,
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

  floorSize: {
    type: Object,
    optional: true,
  },

  "floorSize.width": {
    type: Number,
    min: 1,
    optional: true,
  },

  "floorSize.height": {
    type: Number,
    min: 1,
    optional: true,
  },

  settings: {
    type: Object,
    optional: true,
  },

  "settings.gridInterval": {
    type: Number,
    optional: true,
  },

  "settings.snapInterval": {
    type: Number,
    optional: true,
  },

  "settings.showGrid": {
    type: Boolean,
    optional: true,
  },

  "settings.snapToGrid": {
    type: Boolean,
    optional: true,
  },

  "settings.pixelsPerMeter": {
    type: Number,
    optional: true,
  },

  createdAt: Date,
  updatedAt: Date,
});

/**
 * Schema for Unit shapes
 */
export const UnitShapeSchema = new SimpleSchema({
  orgId: String,
  shapeId: Number,
  name: {
    type: String,
    max: 100,
  },

  points: {
    // *local, stored counter clock wise
    type: Array,
    minCount: 3,
  },
  "points.$": Object,
  "points.$.x": {
    type: Number,
  },
  "points.$.y": {
    type: Number,
  },
  gridReference: Object, // anchor point for the shape (usually 0, 0)
  "gridReference.x": {
    type: Number,
    defaultValue: 0,
  },
  "gridReference.y": {
    type: Number,
    defaultValue: 0,
  },
});

/**
 * Schema for a StorageUnit.
 */
export const StorageUnitSchema = new SimpleSchema({
  orgId: {
    type: String,
  },

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
    allowedValues: ["shelf", "cabinet", "rack", "drawer", "fridge", "other", "custom"],
  },

  shape: {
    type: UnitShapeSchema,
    required: true,
  },

  offset: Object,
  "offset.x": Number,
  "offset.y": Number,

  rotation: {
    type: Number,
    defaultValue: 0, // radians
  },

  scale: Object,
  "scale.x": {
    type: Number,
    defaultValue: 1,
  },
  "scale.y": {
    type: Number,
    defaultValue: 1,
  },

  fill: {
    type: String,
    optional: true,
    max: 50,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },

  photoUrl: {
    type: String,
    optional: true,
  },

  qrGenerated: { type: Boolean, optional: true, defaultValue: false },
});

/**
 * Schema for a StorageLocation.
 */
export const StorageLocationSchema = new SimpleSchema({
  orgId: {
    type: String,
  },

  storageUnitId: {
    type: String,
  },

  storedItems: {
    type: Array,
    optional: true,
  },

  "storedItems.$": {
    type: Object,
  },

  "storedItems.$.itemId": {
    type: String,
    optional: true,
  },

  "storedItems.$.name": {
    type: String,
    min: 1,
    max: 100,
  },

  "storedItems.$.sku": {
    type: String,
    optional: true,
    max: 50,
  },

  "storedItems.$.quantity": {
    type: SimpleSchema.Integer,
    min: 0,
  },

  "storedItems.$.status": {
    type: String,
    optional: true,
    allowedValues: ["OK", "LOW", "CRITICAL"],
  },

  name: {
    type: String,
    optional: true,
    max: 100,
  },

  code: {
    type: String,
    optional: true,
    max: 50,
  },

  imageUrl: {
    type: String,
    optional: true,
    max: 500,
  },

  fill: {
    type: String,
    optional: true,
  },

  // Seeded with the creation date, then stamped each time the location is stocktaken.
  lastStocktakeAt: {
    type: Date,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});
