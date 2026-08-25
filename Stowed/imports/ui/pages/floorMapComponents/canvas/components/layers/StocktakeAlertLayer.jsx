import { Layer, Text } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { getStocktakeAlerts } from "/imports/api/locations/stocktake";

export function StocktakeAlertLayer({
  units,
  storageLocations,
  storageUnits,
  floorMaps,
  sites,
  isCanvasEditMode,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  // Alerts do not appear in edit mode.
  if (isCanvasEditMode) return null;

  const alerts = getStocktakeAlerts({ storageLocations, storageUnits, floorMaps, sites });
  const alertUnitIds = new Set(
    alerts.map((alert) => alert.unit?._id ?? alert.location.storageUnitId).filter(Boolean),
  );

  return (
    // listening={false} so these badges are purely decorative and never
    // intercept the hover/click handling that LowStockLayer (rendered
    // underneath) provides for each unit.
    <Layer listening={false}>
      {units.map((unit) => {
        // No stocktake alert for this unit.
        if (!alertUnitIds.has(unit._id || unit.id)) return null;

        const width = unit.width * px;

        return (
          <Text
            key={unit._id || unit.id}
            x={unit.x * px + width - 10}
            y={unit.y * px - 4}
            text="⚠️"
            fontSize={14}
          />
        );
      })}
    </Layer>
  );
}
