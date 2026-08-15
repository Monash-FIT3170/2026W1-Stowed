import { LIST_FREQUENCIES, LIST_FREQUENCY_LABELS } from "../shoppingLists/constants";

/**
 * How often a schedule fires. Includes everything a shopping list frequency
 * did (weekly/fortnightly/monthly), plus a 30-second cadence for testing.
 */
export const SCHEDULE_FREQUENCIES = {
  ...LIST_FREQUENCIES,
  TEST_30S: "test30s",
};

export const SCHEDULE_FREQUENCY_LABELS = {
  ...LIST_FREQUENCY_LABELS,
  [SCHEDULE_FREQUENCIES.TEST_30S]: "Every 30 seconds (testing)",
};

/**
 * How a schedule decides what goes on the list it generates.
 * EXPLICIT - a fixed product/quantity template, defined on the schedule.
 * AUTO     - reuses the dashboard's low-stock/budget generator.
 */
export const GENERATION_MODES = {
  EXPLICIT: "explicit",
  AUTO: "auto",
};
