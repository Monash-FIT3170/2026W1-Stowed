import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import 'meteor/aldeed:collection2/static';

/**
 * A Product represents a type of inventory item tracked in the system.
 * It holds the core identity and total stock count across all locations.
 *
 * The breakdown of stock per location is stored separately in ProductRecords.
 */
export const Products = new Mongo.Collection('products');

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
});

Products.attachSchema(ProductSchema);
