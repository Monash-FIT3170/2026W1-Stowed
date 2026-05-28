import SimpleSchema from "simpl-schema";

export const ProductSchema = new SimpleSchema({
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

  tag: {
    type: String,
    optional: true,
  },

  category: {
    type: String,
    optional: true,
  },

  sku: {
    type: String,
    optional: true,
  },

  brand: {
    type: String,
    optional: true,
  },

  unitCost: {
    type: Number,
    optional: true,
    min: 0,
  },

  qrCode: {
    type: String,
    optional: true,
  },

  location: {
    type: String,
    optional: true,
  },

  reorderAt: {
    type: SimpleSchema.Integer,
    optional: true,
    min: 0,
  },

  status: {
    type: String,
    optional: true,
  },

  totalQuantity: {
    type: SimpleSchema.Integer,
    min: 0,
  },

  reorderAt: {
    type: SimpleSchema.Integer,
    optional: true,
    min: 0,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },

  images: {
    type: Array,
    optional: true,
  },
  "images.$": {
    type: String,
  },
});

export const ProductRecordSchema = new SimpleSchema({
  productId: {
    type: String,
  },

  locationId: {
    type: String,
  },

  quantity: {
    type: SimpleSchema.Integer,
    min: 0,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});
