import { Layer, Group, Rect, Text, Line } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { snapToGrid } from "../../editor/utils/Snapping";
import { COLOURS } from "../../../FloorMapStyles";

/**
 * Renders a Konva Layer containing ghost previews of units being dragged on canvas
 *
 * @param {Object|null}                                             ghostUnit
 * @param {{ unitId: string|null, deltaX: number, deltaY: number }} dragOffsets
 * @param {Set<string>}                                             selectedIds
 * @param {Object[]}                                                units
 * @param {boolean}                                                 snapEnabled
 * @param {number}                                                  snapSizePx
 *
 * @returns {JSX.Element} A Konva <Layer> containing zero or more ghost groups.
 */
export function GhostLayer({
  ghostUnit,
  dragOffsets,
  selectedIds,
  units,
  snapEnabled,
  snapSizePx,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  const isCustomShape = (unit) =>
    unit?.type === "custom" && Array.isArray(unit.shape?.points) && unit.shape.points.length >= 3;

  const getPolygonPoints = (unit) =>
    unit.shape.points.flatMap((point) => [point.x * px, point.y * px]);

  return (
    <Layer>
      {/* SINGLE DROP GHOST */}
      {ghostUnit && (
        <Group x={ghostUnit.x} y={ghostUnit.y}>
          {isCustomShape(ghostUnit) ? (
            <Line
              points={getPolygonPoints(ghostUnit)}
              closed
              fill={ghostUnit.fill}
              stroke={COLOURS.ACCENT}
              strokeWidth={2}
              dash={[6, 4]}
              opacity={0.45}
            />
          ) : (
            <Rect
              width={ghostUnit.width}
              height={ghostUnit.height}
              fill={ghostUnit.fill}
              stroke={COLOURS.ACCENT}
              strokeWidth={2}
              dash={[6, 4]}
              cornerRadius={4}
              opacity={0.45}
            />
          )}

          <Text
            width={ghostUnit.width}
            height={ghostUnit.height}
            align="center"
            verticalAlign="middle"
            text={ghostUnit.name}
            fontSize={12}
            fill="white"
            opacity={0.7}
            listening={false}
          />
        </Group>
      )}

      {/* DRAG GHOSTS */}
      {dragOffsets.unitId &&
        (() => {
          const ghostIds = selectedIds.has(dragOffsets.unitId)
            ? new Set(selectedIds)
            : new Set([dragOffsets.unitId]);

          return [...ghostIds].map((id) => {
            const unit = units.find((u) => u.id === id);

            if (!unit) return null;

            let ghostX = (unit.x + dragOffsets.deltaX) * px;
            let ghostY = (unit.y + dragOffsets.deltaY) * px;

            if (snapEnabled) {
              ghostX = snapToGrid(ghostX, snapSizePx);
              ghostY = snapToGrid(ghostY, snapSizePx);
            }

            return (
              <Group key={`ghost-${id}`} x={ghostX} y={ghostY}>
                {isCustomShape(unit) ? (
                  <Line
                    points={getPolygonPoints(unit)}
                    closed
                    fill={unit.fill}
                    stroke={COLOURS.ACCENT}
                    strokeWidth={2}
                    dash={[6, 4]}
                    opacity={0.45}
                  />
                ) : (
                  <Rect
                    width={unit.width * px}
                    height={unit.height * px}
                    fill={unit.fill}
                    stroke={COLOURS.ACCENT}
                    strokeWidth={2}
                    dash={[6, 4]}
                    cornerRadius={4}
                    opacity={0.45}
                  />
                )}
              </Group>
            );
          });
        })()}
    </Layer>
  );
}
