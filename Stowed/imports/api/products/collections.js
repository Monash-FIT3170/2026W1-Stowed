import { Mongo } from 'meteor/mongo';
import 'meteor/aldeed:collection2/static';

/**
 * A Product represents a type of inventory item tracked in the system.
 * It holds the core identity and total stock count across all locations.
 *
 * The breakdown of stock per location is stored separately in ProductRecords.
 */
export const Products = new Mongo.Collection('products');

/**
 * A ProductRecord represents the quantity of a specific Product stored at a
 * specific StorageLocation. A single Product may have many ProductRecords —
 * one per location where stock is held.
 *
 * The sum of all ProductRecord quantities for a product should equal
 * the Product's totalQuantity.
 */
export const ProductRecords = new Mongo.Collection('productRecords');

ProductRecords.attachSchema(ProductRecordSchema);
Products.attachSchema(ProductSchema);