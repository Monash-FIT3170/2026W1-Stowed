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
 * Real elapsed time between runs, in milliseconds. Weekly/fortnightly/monthly
 * mirror the same week-counting used for quantity scaling (a "month" is 4
 * weeks here, not a calendar month) so the two stay conceptually consistent.
 */
export const SCHEDULE_FREQUENCY_MS = {
  [SCHEDULE_FREQUENCIES.TEST_30S]: 30 * 1000,
  [SCHEDULE_FREQUENCIES.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [SCHEDULE_FREQUENCIES.FORTNIGHTLY]: 14 * 24 * 60 * 60 * 1000,
  [SCHEDULE_FREQUENCIES.MONTHLY]: 28 * 24 * 60 * 60 * 1000,
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
