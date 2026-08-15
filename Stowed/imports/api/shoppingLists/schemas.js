import SimpleSchema from "simpl-schema";

import { LIST_ORIGINS, ADD_PRODUCT_MODES, LIST_STATUSES } from "./constants";

/**
 * A single product on a shopping list.
 */
export const ShoppingListProductSchema = new SimpleSchema({
  productId: {
    type: String,
  },

  // Snapshot of the product's display info at the time it was added to the
  // list, so the list still renders correctly without re-joining against
  // live product data.
  productName: {
    type: String,
  },

  sku: {
    type: String,
    optional: true,
  },

  category: {
    type: String,
    optional: true,
  },

  inStock: {
    type: SimpleSchema.Integer,
    defaultValue: 0,
  },

  reorderAt: {
    type: SimpleSchema.Integer,
    defaultValue: 0,
  },

  lowStockThreshold: {
    type: SimpleSchema.Integer,
    defaultValue: 0,
  },

  unitCost: {
    type: Number,
    defaultValue: 0,
  },

  quantityWanted: {
    type: SimpleSchema.Integer,
    min: 0,
  },

  addMode: {
    type: String,
    allowedValues: Object.values(ADD_PRODUCT_MODES),
    defaultValue: ADD_PRODUCT_MODES.GENERATED,
  },

  purchased: {
    type: Boolean,
    defaultValue: false,
  },

  received: {
    type: Boolean,
    defaultValue: false,
  },

  // Set once received stock has been assigned to a concrete storage
  // location, via products.allocateReceivedStock.
  allocatedLocationId: {
    type: String,
    optional: true,
  },

  allocatedLocationName: {
    type: String,
    optional: true,
  },

  allocatedAt: {
    type: Date,
    optional: true,
  },
});

/**
 * A shopping list of products to reorder, scoped to a single organisation.
 *
 * Budget constraints are deliberately not modelled here.
 */
export const ShoppingListSchema = new SimpleSchema({
  orgId: {
    type: String,
  },

  createdBy: {
    type: String,
  },

  name: {
    type: String,
  },

  origin: {
    type: String,
    allowedValues: Object.values(LIST_ORIGINS),
  },

  // Soft, one-way audit trail for lists created by a Schedule tick.
  // Snapshotted at generation time and never synced afterwards — deleting
  // or editing the schedule has no effect on lists it already produced.
  scheduleId: {
    type: String,
    optional: true,
  },

  scheduleName: {
    type: String,
    optional: true,
  },

  status: {
    type: String,
    allowedValues: Object.values(LIST_STATUSES),
    defaultValue: LIST_STATUSES.DRAFT,
  },

  siteId: {
    type: String,
    optional: true,
  },

  // Set when a list is archived. archivedWithPendingItems records whether
  // that happened before every item was marked received, so the UI can
  // still show the warning after the fact.
  archivedAt: {
    type: Date,
    optional: true,
  },

  archivedWithPendingItems: {
    type: Boolean,
    optional: true,
  },

  items: {
    type: Array,
    defaultValue: [],
  },

  "items.$": {
    type: ShoppingListProductSchema,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});
