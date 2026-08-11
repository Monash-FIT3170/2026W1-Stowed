export const DEFAULT_STOCKTAKE_INTERVAL_DAYS = 180;
export const MAX_STOCKTAKE_INTERVAL_DAYS = 3650;
export const DUE_SOON_DAYS = 14;

export const STOCKTAKE_STATUS = {
  OVERDUE: "overdue",
  DUE_SOON: "due-soon",
  OK: "ok",
};

function normaliseInterval(intervalDays) {
  const interval = Number(intervalDays);
  return Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_STOCKTAKE_INTERVAL_DAYS;
}

export function isValidStocktakeInterval(intervalDays) {
  return (
    Number.isInteger(intervalDays) &&
    intervalDays >= 1 &&
    intervalDays <= MAX_STOCKTAKE_INTERVAL_DAYS
  );
}

export function getNextStocktakeDate(lastStocktakeAt, intervalDays) {
  const lastStocktake = new Date(lastStocktakeAt);
  if (Number.isNaN(lastStocktake.getTime())) return null;
  const dueAt = new Date(lastStocktake);
  dueAt.setDate(dueAt.getDate() + normaliseInterval(intervalDays));
  return dueAt;
}

export function getLocationStocktakeStatus(lastStocktakeAt, intervalDays, now = new Date()) {
  const dueAt = getNextStocktakeDate(lastStocktakeAt, intervalDays);
  if (!dueAt) return STOCKTAKE_STATUS.OK;
  const daysUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysUntilDue <= 0) return STOCKTAKE_STATUS.OVERDUE;
  if (daysUntilDue <= DUE_SOON_DAYS) return STOCKTAKE_STATUS.DUE_SOON;
  return STOCKTAKE_STATUS.OK;
}
