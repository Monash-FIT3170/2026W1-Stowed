import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import {
  FloorMaps,
  Sites,
  StorageLocations,
  StorageUnits,
} from "/imports/api/locations/collections";
import {
  DEFAULT_STOCKTAKE_INTERVAL_DAYS,
  getDaysUntilDue,
  getLocationStocktakeStatus,
  STOCKTAKE_STATUS,
} from "/imports/api/locations/stocktake";

/** Overdue locations are the point of the panel, so they sort to the top. */
const STATUS_ORDER = {
  [STOCKTAKE_STATUS.OVERDUE]: 0,
  [STOCKTAKE_STATUS.DUE_SOON]: 1,
  [STOCKTAKE_STATUS.OK]: 2,
};

const SECTIONS = [
  { status: STOCKTAKE_STATUS.OVERDUE, title: "Overdue" },
  { status: STOCKTAKE_STATUS.DUE_SOON, title: "Due soon" },
  { status: STOCKTAKE_STATUS.OK, title: "Up to date" },
];

function formatDate(value) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "12 days overdue" / "Due today" / "Due in 6 days". */
function dueLabel(status, daysUntilDue) {
  if (daysUntilDue == null) return "Never counted";
  if (status !== STOCKTAKE_STATUS.OVERDUE) return `Due in ${plural(daysUntilDue, "day")}`;
  return daysUntilDue === 0 ? "Due today" : `${plural(-daysUntilDue, "day")} overdue`;
}

/**
 * Turns a unit's storage locations into rows carrying their stocktake state,
 * ordered by urgency: overdue first, then the soonest due within each group.
 *
 * @param {Array<{ _id: string, name?: string, lastStocktakeAt?: Date }>} locations
 * @param {number} [intervalDays] - The owning Site's stocktakeIntervalDays.
 * @param {Date} [now]
 * @returns {Array<{ location: object, status: string, daysUntilDue: number|null }>}
 */
export function buildStocktakeRows(locations = [], intervalDays, now = new Date()) {
  return locations
    .map((location) => ({
      location,
      status: getLocationStocktakeStatus(location.lastStocktakeAt, intervalDays, now),
      daysUntilDue: getDaysUntilDue(location.lastStocktakeAt, intervalDays, now),
    }))
    .sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      // Never-counted locations have no due date, so they trail their group.
      const aDays = a.daysUntilDue ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysUntilDue ?? Number.POSITIVE_INFINITY;
      if (aDays !== bDays) return aDays - bDays;
      return (a.location.name || "").localeCompare(b.location.name || "");
    });
}

/** @returns {{ overdue: number, dueSoon: number, ok: number, total: number }} */
export function summariseStocktakeRows(rows = []) {
  return {
    overdue: rows.filter((row) => row.status === STOCKTAKE_STATUS.OVERDUE).length,
    dueSoon: rows.filter((row) => row.status === STOCKTAKE_STATUS.DUE_SOON).length,
    ok: rows.filter((row) => row.status === STOCKTAKE_STATUS.OK).length,
    total: rows.length,
  };
}

/**
 * Presentational half of the floor map's slide-out panel. Split out from the
 * container below so it can be rendered from tests with plain fixtures.
 *
 * @param {string} unitName
 * @param {ReturnType<typeof buildStocktakeRows>} rows
 * @param {boolean} canStocktake - Whether the viewer holds "stocktake.save".
 * @param {() => void} onClose
 */
export function UnitStocktakePanelView({ unitName, rows = [], canStocktake = false, onClose }) {
  const counts = summariseStocktakeRows(rows);

  // The panel takes its tone from the worst status present.
  const tone =
    counts.total === 0
      ? "no-items"
      : counts.overdue > 0
        ? "overdue"
        : counts.dueSoon > 0
          ? "due-soon"
          : "ok";

  const title = {
    "no-items": "No locations",
    overdue: "Stocktake overdue",
    "due-soon": "Stocktake due soon",
    ok: "All counted",
  }[tone];

  const summary =
    counts.total === 0
      ? "Empty"
      : counts.overdue + counts.dueSoon > 0
        ? [
            counts.overdue > 0 && `${counts.overdue} overdue`,
            counts.dueSoon > 0 && `${counts.dueSoon} due soon`,
          ]
            .filter(Boolean)
            .join(" · ")
        : `${plural(counts.total, "location")} current`;

  return (
    // borderLeft/flex overrides: this panel only ever sits at the top of the
    // floor map's right-hand column, which draws the border itself.
    <div className="low-stock-panel" style={{ borderLeft: "none", flex: "0 0 auto" }}>
      <div className={`panel-header ${tone}`}>
        <div>
          <div className="panel-header-label">{unitName}</div>
          <div className="panel-header-title">{title}</div>
          <div className={`panel-status-badge ${tone}`}>{summary}</div>
        </div>
        <button className="panel-close-btn" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className="panel-content">
        {counts.total === 0 ? (
          <div className="panel-empty">No storage locations in this unit.</div>
        ) : (
          SECTIONS.map(({ status, title: sectionTitle }) => {
            const sectionRows = rows.filter((row) => row.status === status);
            if (sectionRows.length === 0) return null;

            return (
              <div className="panel-section" key={status}>
                <div className={`panel-section-title ${status}`}>{sectionTitle}</div>
                <ul className="panel-locations">
                  {sectionRows.map(({ location, daysUntilDue }) => (
                    <li className={`panel-location ${status}`} key={location._id}>
                      <Link className="panel-location-main" to={`/locations/${location._id}`}>
                        <span className="panel-location-name">
                          {location.name || "Unnamed location"}
                        </span>
                        <span className="panel-location-meta">
                          {location.code ? `${location.code} · ` : ""}
                          Counted {formatDate(location.lastStocktakeAt)}
                        </span>
                      </Link>
                      <div className="panel-location-side">
                        <span className={`panel-location-due ${status}`}>
                          {dueLabel(status, daysUntilDue)}
                        </span>
                        {canStocktake && (
                          <Link className="panel-location-action" to={`/stocktake/${location._id}`}>
                            Stocktake
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Lists the storage locations inside the selected storage unit, flagging which
 * ones are due a stocktake and linking each to its detail and count screens.
 *
 * @param {{ _id?: string, id?: string, name: string }} unit - The selected canvas unit.
 * @param {boolean} canStocktake
 * @param {() => void} onClose
 */
export function UnitStocktakePanel({ unit, canStocktake, onClose }) {
  const unitId = unit?._id ?? unit?.id ?? null;

  const { locations, intervalDays } = useTracker(() => {
    Meteor.subscribe("locations.all");

    // The interval lives on the Site, so walk up unit → floor map → site.
    const storageUnit = unitId ? StorageUnits.findOne(unitId) : null;
    const floorMap = storageUnit ? FloorMaps.findOne(storageUnit.floorMapId) : null;
    const site = floorMap ? Sites.findOne(floorMap.siteId) : null;

    return {
      locations: unitId ? StorageLocations.find({ storageUnitId: unitId }).fetch() : [],
      intervalDays: site?.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS,
    };
  }, [unitId]);

  return (
    <UnitStocktakePanelView
      unitName={unit?.name}
      rows={buildStocktakeRows(locations, intervalDays)}
      canStocktake={canStocktake}
      onClose={onClose}
    />
  );
}
