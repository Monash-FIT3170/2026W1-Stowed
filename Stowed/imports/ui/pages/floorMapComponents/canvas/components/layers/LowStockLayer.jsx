import { Layer, Line, Rect } from "react-konva";
import { useEditor } from "../../editor/EditorContext";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { flattenPoints, isDrawnShape } from "../units/StorageUnit";

export function LowStockLayer({ units, onHover, onHoverEnd, onUnitClick, isCanvasEditMode }) {
  const { lowStockByUnitId, setSelectedUnit, setIsPanelOpen } = useEditor();
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  if (isCanvasEditMode) return null;

  function getItemsForUnit(unit) {
    return lowStockByUnitId?.[unit._id] ?? [];
  }

  return (
    <Layer>
      {units.map((unit) => {
        const items = getItemsForUnit(unit);
        const hasLowStock = items.some((i) => i.isLow);

        // No data - show unit's own colour (transparent overlay)
        // Has low stock - red tint
        // All ok - subtle green tint
        const fill =
          items.length === 0
            ? "rgba(0, 0, 0, 0)"
            : hasLowStock
              ? "rgba(220, 38, 38, 0.45)"
              : "rgba(34, 197, 94, 0.30)";

        const isDrawn = isDrawnShape(unit);

        // define common actions for single source of truth
        const mouseOnAction = (e) => {
          e.target.fill(fill);
          e.target.getLayer().batchDraw();
          const stage = e.target.getStage();
          const pointer = stage.getPointerPosition();
          const box = stage.container().getBoundingClientRect();
          onHover?.({
            unit,
            items,
            x: box.left + pointer.x + 12,
            y: box.top + pointer.y + 12,
          });
        };
        const mouseMoveAction = (e) => {
          const stage = e.target.getStage();
          const pointer = stage.getPointerPosition();
          const box = stage.container().getBoundingClientRect();
          onHover?.({
            unit,
            items,
            x: box.left + pointer.x + 12,
            y: box.top + pointer.y + 12,
          });
        };
        const mouseOffAction = (e) => {
          e.target.fill(fill);
          e.target.getLayer().batchDraw();
          onHoverEnd?.();
        };
        const clickAction = () => {
          const unitWithItems = { ...unit, mockItems: items };
          setSelectedUnit(unitWithItems);
          setIsPanelOpen(true);
          onUnitClick?.(unit._id || unit.id, unitWithItems);
        };

        if (isDrawn) {
          return (
            <Line
              key={unit._id || unit.id}
              x={unit.x * px}
              y={unit.y * px}
              points={flattenPoints(unit)}
              closed
              fill={fill}
              cornerRadius={4}
              listening={true}
              onMouseEnter={mouseOnAction}
              onMouseMove={mouseMoveAction}
              onMouseLeave={mouseOffAction}
              onClick={clickAction}
            />
          );
        } else {
          return (
            < Rect
              key={unit._id || unit.id}
              x={unit.x * px}
              y={unit.y * px}
              width={unit.width * px}
              height={unit.height * px}
              fill={fill}
              cornerRadius={4}
              listening={true}
              onMouseEnter={mouseOnAction}
              onMouseMove={mouseMoveAction}
              onMouseLeave={mouseOffAction}
              onClick={clickAction}
            />
          );
        }
      })}
    </Layer>
  );
}
