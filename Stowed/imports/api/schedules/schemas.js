import SimpleSchema from "simpl-schema";

import { SCHEDULE_FREQUENCIES, GENERATION_MODES } from "./constants";
import { BUDGET_STRATEGIES } from "../shoppingLists/constants";

const ScheduleItemSchema = new SimpleSchema({
  productId: {
    type: String,
  },

  quantityWanted: {
    type: SimpleSchema.Integer,
    min: 0,
  },
});

const ScheduleAutoConfigSchema = new SimpleSchema({
  strategy: {
    type: String,
    allowedValues: Object.values(BUDGET_STRATEGIES),
  },

  // null/omitted means no budget limit, every low stock product is included,
  // matching the dashboard's existing "blank budget" behaviour.
  budgetCents: {
    type: SimpleSchema.Integer,
    optional: true,
    min: 0,
  },
});

export const ScheduleSchema = new SimpleSchema({
  orgId: {
    type: String,
  },

  createdBy: {
    type: String,
  },

  name: {
    type: String,
  },

  frequency: {
    type: String,
    allowedValues: Object.values(SCHEDULE_FREQUENCIES),
  },

  generationMode: {
    type: String,
    allowedValues: Object.values(GENERATION_MODES),
  },

  // Required iff generationMode is EXPLICIT, forbidden otherwise.
  items: {
    type: Array,
    optional: true,
    custom() {
      const mode = this.field("generationMode").value;

      if (mode === GENERATION_MODES.EXPLICIT && !this.value) {
        return SimpleSchema.ErrorTypes.REQUIRED;
      }

      if (mode === GENERATION_MODES.AUTO && this.value) {
        return "itemsNotAllowedForAutoSchedule";
      }

      return undefined;
    },
  },

  "items.$": {
    type: ScheduleItemSchema,
  },

  // Required iff generationMode is AUTO, forbidden otherwise.
  autoConfig: {
    type: ScheduleAutoConfigSchema,
    optional: true,
    custom() {
      const mode = this.field("generationMode").value;

      if (mode === GENERATION_MODES.AUTO && !this.value) {
        return SimpleSchema.ErrorTypes.REQUIRED;
      }

      if (mode === GENERATION_MODES.EXPLICIT && this.value) {
        return "autoConfigNotAllowedForExplicitSchedule";
      }

      return undefined;
    },
  },

  // Stamped onto every list this schedule generates.
  siteId: {
    type: String,
    optional: true,
  },

  // The pause/resume flag. A paused schedule is simply skipped by the tick.
  isActive: {
    type: Boolean,
    defaultValue: true,
  },

  nextRunAt: {
    type: Date,
  },

  lastRunAt: {
    type: Date,
    optional: true,
  },

  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});
