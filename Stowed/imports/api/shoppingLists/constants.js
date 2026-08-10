/** constants used in the shopping lists module */

/**
 * How a shopping list is built.
 * AUTOMATED - generated from current stock on a recurring frequency.
 * MANUAL    - assembled by the user, with no schedule.
 */
export const SHOPPING_LIST_MODES = {
  AUTOMATED: "automated",
  MANUAL: "manual",
};

/**
 * Ways for product to be on a shopping list.
 * GENERATED - added automatically because stock hit the reorder threshold.
 * MANUAL    - added by the user.
 */
export const ADD_PRODUCT_MODES = {
  GENERATED: "generated",
  MANUAL: "manual",
};

/**
 * How often an automated list is generated.
 * The value is stored on the list; the label is shown to the user.
 */
export const LIST_FREQUENCIES = {
  WEEKLY: "weekly",
  FORTNIGHTLY: "fortnightly",
  MONTHLY: "monthly",
};

/**
 * Display labels for each frequency, so stored values are never shown raw.
 */
export const LIST_FREQUENCY_LABELS = {
  [LIST_FREQUENCIES.WEEKLY]: "Weekly",
  [LIST_FREQUENCIES.FORTNIGHTLY]: "Fortnightly",
  [LIST_FREQUENCIES.MONTHLY]: "Monthly",
};

/**
 * Number of reorder cycles a generated list should cover, per frequency.
 * A monthly list buys roughly four times what a weekly list buys.
 */
export const FREQUENCY_WEEKS = {
  [LIST_FREQUENCIES.WEEKLY]: 1,
  [LIST_FREQUENCIES.FORTNIGHTLY]: 2,
  [LIST_FREQUENCIES.MONTHLY]: 4,
};

/**
 * Lifecycle of a shopping list.
 * DRAFT - being built, not yet confirmed and saved.
 * SAVED - confirmed by the user and ready to shop against.
 */
export const LIST_STATUSES = {
  DRAFT: "draft",
  SAVED: "saved",
};


/**
 * How an optional budget is spread across low stock products at generation
 * time. The budget itself is not stored on the list; it only shapes the
 * generated items.
 *
 * MAX_PRODUCTS - whole shortfall each, cheapest line first.
 * SPREAD       - one unit each, cheapest unit first, then top up.
 * URGENT       - whole shortfall each, closest to stockout first.
 */
export const BUDGET_STRATEGIES = {
  MAX_PRODUCTS: "maxProducts",
  SPREAD: "spread",
  URGENT: "urgent",
};

export const BUDGET_STRATEGY_LABELS = {
  [BUDGET_STRATEGIES.MAX_PRODUCTS]: "Restock as many products as possible",
  [BUDGET_STRATEGIES.SPREAD]: "Spread across as many products as possible",
  [BUDGET_STRATEGIES.URGENT]: "Most urgent first",
};