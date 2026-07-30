import SimpleSchema from "simpl-schema";

import {
  SHOPPING_LIST_MODES,
  ADD_PRODUCT_MODES,
  LIST_FREQUENCIES,
  LIST_STATUSES,
} from "./constants";

/**
 * A single product on a shopping list.
 */
export const ShoppingListProductSchema = new SimpleSchema({
  productId: {
    type: String,
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

  mode: {
    type: String,
    allowedValues: Object.values(SHOPPING_LIST_MODES),
  },

  // Only set on automated lists. The check below keeps mode and frequency
  // consistent so a manual list can never carry a stale frequency.
  frequency: {
    type: String,
    optional: true,
    allowedValues: Object.values(LIST_FREQUENCIES),
    custom() {
      const mode = this.field("mode").value;

      if (mode === SHOPPING_LIST_MODES.AUTOMATED && !this.value) {
        return SimpleSchema.ErrorTypes.REQUIRED;
      }

      if (mode === SHOPPING_LIST_MODES.MANUAL && this.value) {
        return "frequencyNotAllowedForManualList";
      }

      return undefined;
    },
  },

  status: {
    type: String,
    allowedValues: Object.values(LIST_STATUSES),
    defaultValue: LIST_STATUSES.DRAFT,
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