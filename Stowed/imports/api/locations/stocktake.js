// imports/api/locations/stocktake.js
//
// Shared stocktake scheduling maths. Both the server-side sweep
// ("storageLocations.checkStocktakeDue") and the Alerts page derive due dates
// from here so the persisted `stocktakeDue` flag and the UI can never disagree.

/** Used when a Site has no interval configured. Matches SiteSchema's default. */
export const DEFAULT_STOCKTAKE_INTERVAL_DAYS = 180;

/** A location is flagged "due soon" this many days before its deadline. */
export const DUE_SOON_DAYS = 14;

export const MAX_STOCKTAKE_INTERVAL_DAYS = 3650;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const STOCKTAKE_STATUS = {
  OVERDUE: "overdue",
  DUE_SOON: "due-soon",
  OK: "ok",
};

function normaliseInterval(intervalDays) {
  const interval = Number(intervalDays);
  return Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_STOCKTAKE_INTERVAL_DAYS;
}

/**
 * The date a location is next due to be counted.
 *
 * @param {Date} lastStocktakeAt - When the location was last counted.
 * @param {number} [intervalDays] - The parent Site's stocktakeIntervalDays.
 * @returns {Date|null} null when lastStocktakeAt is missing or unparseable.
 */
export function getNextStocktakeDate(lastStocktakeAt, intervalDays) {
  if (!lastStocktakeAt) return null;

  const next = new Date(lastStocktakeAt);
  if (Number.isNaN(next.getTime())) return null;

  next.setDate(next.getDate() + normaliseInterval(intervalDays));
  return next;
}

/**
 * Whole days until a location is due. Zero or negative means overdue.
 *
 * @returns {number|null} null when no due date can be calculated.
 */
export function getDaysUntilDue(lastStocktakeAt, intervalDays, now = new Date()) {
  const next = getNextStocktakeDate(lastStocktakeAt, intervalDays);
  if (!next) return null;
  return Math.ceil((next.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * Whether a location's stocktake deadline has passed. This is the value
 * persisted to StorageLocations.stocktakeDue.
 */
export function isStocktakeDue(lastStocktakeAt, intervalDays, now = new Date()) {
  const next = getNextStocktakeDate(lastStocktakeAt, intervalDays);
  if (!next) return false;
  return now.getTime() >= next.getTime();
}

export function isValidStocktakeInterval(intervalDays) {
  return (
    Number.isInteger(intervalDays) &&
    intervalDays >= 1 &&
    intervalDays <= MAX_STOCKTAKE_INTERVAL_DAYS
  );
}

export function getLocationStocktakeStatus(lastStocktakeAt, intervalDays, now = new Date()) {
  const dueAt = getNextStocktakeDate(lastStocktakeAt, intervalDays);
  if (!dueAt) return STOCKTAKE_STATUS.OK;
  const daysUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / MS_PER_DAY);
  if (daysUntilDue <= 0) return STOCKTAKE_STATUS.OVERDUE;
  if (daysUntilDue <= DUE_SOON_DAYS) return STOCKTAKE_STATUS.DUE_SOON;
  return STOCKTAKE_STATUS.OK;
}
