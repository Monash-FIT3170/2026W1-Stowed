import { Layer, Line, Rect } from "react-konva";
import { useEditor } from "../../editor/EditorContext";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { COLOURS } from "../../../FloorMapStyles";
import { flattenPoints, isDrawnShape } from "../units/StorageUnit";

export function buildLowStockOverlay({
  unit,
  fill,
  selected,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onActivate,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  const interactionProps = {
    listening: true,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    onClick: onActivate,
    onTap: onActivate,
  };

  return isDrawnShape(unit) ? (
    <Line
      key={unit._id || unit.id}
      x={unit.x * px}
      y={unit.y * px}
      points={flattenPoints(unit)}
      closed
      fill={fill}
      stroke={selected ? COLOURS.ACCENT : undefined}
      strokeWidth={selected ? 3 : 0}
      cornerRadius={4}
      {...interactionProps}
    />
  ) : (
    <Rect
      key={unit._id || unit.id}
      x={unit.x * px}
      y={unit.y * px}
      width={unit.width * px}
      height={unit.height * px}
      fill={fill}
      stroke={selected ? COLOURS.ACCENT : undefined}
      strokeWidth={selected ? 3 : 0}
      cornerRadius={4}
      {...interactionProps}
    />
  );
}

export function LowStockLayer({
  units,
  onHover,
  onHoverEnd,
  onUnitClick,
  isCanvasEditMode,
  selectedStorageUnitId,
}) {
  const { lowStockByUnitId, setSelectedUnit, setIsPanelOpen } = useEditor();

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
            ? COLOURS.OVER_TRANSPARENT
            : hasLowStock
              ? COLOURS.OVER_RED
              : COLOURS.OVER_GREEN;
        const selected = selectedStorageUnitId === (unit._id || unit.id);

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

        return buildLowStockOverlay({
          unit,
          fill,
          selected,
          onMouseEnter: mouseOnAction,
          onMouseMove: mouseMoveAction,
          onMouseLeave: mouseOffAction,
          onActivate: clickAction,
        });
      })}
    </Layer>
  );
}
