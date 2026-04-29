import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import 'meteor/aldeed:collection2/static';

/**
 * A ProductRecord represents the quantity of a specific Product stored at a
 * specific StorageLocation. A single Product may have many ProductRecords —
 * one per location where stock is held.
 *
 * The sum of all ProductRecord quantities for a product should equal
 * the Product's totalQuantity.
 */
export const ProductRecords = new Mongo.Collection('productRecords');

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
