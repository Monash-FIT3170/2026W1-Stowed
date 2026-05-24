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
    allowedValues: [
      "shelf",
      "cabinet",
      "rack",
      "drawer",
      "fridge",
      "other",
      "custom",
    ],
  },

  position: {
    type: Object,
  },

  "position.x": {
    type: Number,
    min: 0,
  },

  "position.y": {
    type: Number,
    min: 0,
  },

  "position.width": {
    type: Number,
    min: 1,
  },

  "position.height": {
    type: Number,
    min: 1,
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

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});
