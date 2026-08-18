// imports/api/locations/stocktake.js
//
// Shared stocktake scheduling maths. The Alerts, Locations, and Location
// detail pages all derive due dates from here, so a location's status is
// computed on the fly from its lastStocktakeAt and its Site's interval.

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

/**
 * Derive stocktake alerts from the organisation-scoped location hierarchy.
 * Both the full Alerts page and dashboard preview consume this result so they
 * agree on intervals, due dates, paths, statuses, and urgency ordering.
 */
export function getStocktakeAlerts({
  storageLocations = [],
  storageUnits = [],
  floorMaps = [],
  sites = [],
  now = new Date(),
  statuses = [STOCKTAKE_STATUS.OVERDUE, STOCKTAKE_STATUS.DUE_SOON],
} = {}) {
  const unitsById = new Map(storageUnits.map((unit) => [unit._id, unit]));
  const floorMapsById = new Map(floorMaps.map((floorMap) => [floorMap._id, floorMap]));
  const sitesById = new Map(sites.map((site) => [site._id, site]));
  const includedStatuses = new Set(statuses);

  return storageLocations
    .map((location) => {
      const unit = unitsById.get(location.storageUnitId);
      const floorMap = unit ? floorMapsById.get(unit.floorMapId) : null;
      const site = floorMap ? sitesById.get(floorMap.siteId) : null;
      const intervalDays = site?.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS;

      return {
        location,
        unit,
        floorMap,
        site,
        status: getLocationStocktakeStatus(location.lastStocktakeAt, intervalDays, now),
        daysUntilDue: getDaysUntilDue(location.lastStocktakeAt, intervalDays, now),
        dueDate: getNextStocktakeDate(location.lastStocktakeAt, intervalDays),
        intervalDays,
        path: [site?.name, floorMap?.name, unit?.name].filter(Boolean).join(" › "),
      };
    })
    .filter((alert) => includedStatuses.has(alert.status))
    .sort((a, b) => {
      const urgency =
        (a.daysUntilDue ?? Number.POSITIVE_INFINITY) - (b.daysUntilDue ?? Number.POSITIVE_INFINITY);
      if (urgency !== 0) return urgency;
      return (a.location.name ?? "").localeCompare(b.location.name ?? "");
    });
}

export function describeStocktakeTiming(daysUntilDue) {
  if (daysUntilDue === null) return "Never counted";
  if (daysUntilDue > 0) {
    return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
  }

  const overdueBy = Math.abs(daysUntilDue);
  if (overdueBy === 0) return "Due today";
  return `${overdueBy} day${overdueBy === 1 ? "" : "s"} overdue`;
}
