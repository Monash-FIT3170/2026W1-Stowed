import { Layer, Rect, Text, Group, Circle } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { getStocktakeAlerts, STOCKTAKE_STATUS } from "/imports/api/locations/stocktake";

// Colour the badge by urgency, matching the Overdue / Due soon split that the
// UnitStocktakePanel uses in the side panel.
const ALERT_COLOURS = {
  [STOCKTAKE_STATUS.OVERDUE]: "#dc2626", // red — deadline has passed
  [STOCKTAKE_STATUS.DUE_SOON]: "#f59e0b", // amber — due within the warning window
};

// Overdue outranks due soon, so a unit holding both shows the more urgent colour.
const STATUS_SEVERITY = {
  [STOCKTAKE_STATUS.OVERDUE]: 2,
  [STOCKTAKE_STATUS.DUE_SOON]: 1,
};

export function StocktakeAlertLayer({
  units,
  storageLocations,
  storageUnits,
  floorMaps,
  sites,
  isCanvasEditMode,
  onUnitClick,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  // Alerts do not appear in edit mode.
  if (isCanvasEditMode) return null;

  const alerts = getStocktakeAlerts({ storageLocations, storageUnits, floorMaps, sites });

  // Collapse each unit's alerting locations down to its single most urgent status.
  const statusByUnitId = new Map();
  for (const alert of alerts) {
    const unitId = alert.unit?._id ?? alert.location.storageUnitId;
    if (!unitId) continue;
    const current = statusByUnitId.get(unitId);
    if (!current || STATUS_SEVERITY[alert.status] > STATUS_SEVERITY[current]) {
      statusByUnitId.set(unitId, alert.status);
    }
  }

  return (
    <Layer>
      {units.map((unit) => {
        const status = statusByUnitId.get(unit._id || unit.id);

        // No stocktake alert for this unit.
        if (!status) return null;

        const width = unit.width * px;
        const height = unit.height * px;
        const badgeX = unit.x * px + width - 6;
        const badgeY = unit.y * px + 6;

        return (
          <Group key={unit._id || unit.id}>
            {/* Clickable region over the unit so tapping the badge opens its panel. */}
            <Rect
              x={unit.x * px}
              y={unit.y * px}
              width={width}
              height={height}
              fill="rgba(0, 0, 0, 0)"
              listening={true}
              onClick={() => onUnitClick?.(unit._id || unit.id, unit)}
            />

            {/* Severity badge in the top-right corner. */}
            <Circle
              x={badgeX}
              y={badgeY}
              radius={8}
              fill={ALERT_COLOURS[status]}
              listening={false}
            />
            <Text
              x={badgeX - 8}
              y={badgeY - 6}
              width={16}
              align="center"
              text="!"
              fontSize={12}
              fontStyle="bold"
              fill="#ffffff"
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
}
