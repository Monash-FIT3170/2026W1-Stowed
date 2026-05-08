import { Layer, Group, Rect, Text } from "react-konva";
import { CANVAS_CONFIG } from "../Canvas";
import { snapToGrid } from "../../editor/utils/Snapping";

export function GhostLayer({
  ghostUnit,
  dragOffsets,
  selectedIds,
  units,
  snapEnabled,
  gridSizePx,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  return (
    <Layer>
      {/* SINGLE DROP GHOST */}
      {ghostUnit && (
        <Group x={ghostUnit.x} y={ghostUnit.y}>
          <Rect
            width={ghostUnit.width}
            height={ghostUnit.height}
            fill={ghostUnit.fill}
            stroke="white"
            strokeWidth={2}
            dash={[6, 4]}
            cornerRadius={4}
            opacity={0.45}
          />
          <Text
            width={ghostUnit.width}
            height={ghostUnit.height}
            align="center"
            verticalAlign="middle"
            text={ghostUnit.name}
            fontSize={12}
            fill="white"
            opacity={0.7}
          />
        </Group>
      )}

      {/* MULTI-DRAG GHOSTS */}
      {dragOffsets.unitId &&
        [...selectedIds].map((id) => {
          const unit = units.find((u) => u.id === id);
          if (!unit) return null;

          let ghostX = (unit.x + dragOffsets.deltaX) * px;
          let ghostY = (unit.y + dragOffsets.deltaY) * px;

          if (snapEnabled) {
            ghostX = snapToGrid(ghostX, gridSizePx);
            ghostY = snapToGrid(ghostY, gridSizePx);
          }

          return (
            <Group key={`ghost-${id}`} x={ghostX} y={ghostY}>
              <Rect
                width={unit.width * px}
                height={unit.height * px}
                fill={unit.fill}
                stroke="white"
                strokeWidth={2}
                dash={[6, 4]}
                cornerRadius={4}
                opacity={0.45}
              />
              <Text
                width={unit.width * px}
                height={unit.height * px}
                align="center"
                verticalAlign="middle"
                text={unit.name}
                fontSize={12}
                fill="white"
                opacity={0.7}
              />
            </Group>
          );
        })}
    </Layer>
  );
}