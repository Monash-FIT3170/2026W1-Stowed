
import SimpleSchema from 'simpl-schema';

export const ProductSchema = new SimpleSchema({
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
  imageUrl: {
    type: String,
    optional: true,
    max: 500,
  },

  totalQuantity: {
    type: SimpleSchema.Integer,
    min: 0,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },

  imageUrl: {
    type: String,
    optional: true,
    max: 500,
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

ProductRecords.attachSchema(ProductRecordSchema);

Products.attachSchema(ProductSchema);
