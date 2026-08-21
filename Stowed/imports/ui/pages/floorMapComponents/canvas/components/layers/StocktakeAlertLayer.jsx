import { Layer, Rect, Text, Group } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { getStocktakeAlerts } from "/imports/api/locations/stocktake";

export function StocktakeAlertLayer({units,  storageLocations, storageUnits, floorMaps, sites, isCanvasEditMode, onUnitClick}) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;

    // alerts do not appear in edit mode
    if (isCanvasEditMode) return null;

    // get all current stocktake alerts
    const alerts = getStocktakeAlerts({
        storageLocations,
        storageUnits,
        floorMaps,
        sites,
    })

    // go through each of the alerts and find the storage unit it belongs to
    // and store inside alertsByUnitId
    const alertsByUnitId = new Map(
        alerts.map((alert) => {
            const location = storageLocations.find(
            (location) => location._id === alert.location._id
            );
            return [location.storageUnitId, alert];
        })
    );

  return (
    <Layer>
      {units.map((unit) => {
        const alert = alertsByUnitId.get(unit._id || unit.id);

        // No stocktake alert for this unit
        if (!alert) return null;

        const width = unit.width * px;
        const height = unit.height * px;

        return (
          <Group key={unit._id || unit.id}>
            {/* represents the retangular region around the storage unit */}
            <Rect
              x={unit.x * px}
              y={unit.y * px}
              width={width}
              height={height}
              fill="rgba(0, 0, 0, 0)"
              listening={true}
              onClick={() => {
                onUnitClick?.(unit._id || unit.id, unit);
              }}
            />

            {/* alert icon in top right corner */}
            <Text
            x={unit.x * px + width - 8}
            y={unit.y * px - 6}
            text="⚠️"
            fontSize={14}
            listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
}