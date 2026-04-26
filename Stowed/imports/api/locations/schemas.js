// imports/api/locations/schemas.js
import SimpleSchema from 'simpl-schema';

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
  createdAt: Date,
  updatedAt: Date,
});

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

export const StorageUnitSchema = new SimpleSchema({
  floorMapId: String,
  name: {
    type: String,
    min: 1,
    max: 100,
  },
  type: {
    type: String,
    allowedValues: ['shelf', 'cabinet', 'rack', 'drawer', 'fridge', 'other'],
  },
  'position.x': Number,
  'position.y': Number,
  'position.width': Number,
  'position.height': Number,
  createdAt: Date,
  updatedAt: Date,
});

export const StorageLocationSchema = new SimpleSchema({
  storageUnitId: String,
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
  createdAt: Date,
  updatedAt: Date,
});