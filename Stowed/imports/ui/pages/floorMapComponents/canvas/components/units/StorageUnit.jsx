import { Group, Rect, Text, Line } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { COLOURS } from "../../../FloorMapStyles";

/**
 * Individual storage unit rendered as a labelled rectangle on the canvas.
 *
 * @param {Object}                  unit
 * @param {boolean}                 isSelected
 * @param {boolean}                 isCanvasEditMode
 * @param {(e) => void}             onSelect
 * @param {(e) => void}             onDragMove
 * @param {(e) => void}             onDragEnd
 * @param {(e) => void}             onTransformEnd
 * @param {React.RefObject}         groupRef
 *
 * @returns {JSX.Element}
 */
export function StorageUnit({
  unit,
  isSelected,
  isCanvasEditMode,
  onSelect,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  groupRef,
}) {
  const canMove = isCanvasEditMode;
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  const isCustomShape =
    unit.type === "custom" && Array.isArray(unit.shape?.points) && unit.shape.points.length >= 3;

  const polygonPoints = isCustomShape
    ? unit.shape.points.flatMap((point) => [point.x * px, point.y * px])
    : [];

  return (
    <Group
      ref={groupRef}
      id={unit.id}
      x={unit.x * px}
      y={unit.y * px}
      draggable={canMove}
      onClick={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {/* MAIN BODY */}
      {isCustomShape ? (
        <Line
          points={polygonPoints}
          closed
          fill={unit.fill}
          stroke={isSelected ? COLOURS.ACCENT : "transparent"}
          strokeWidth={2}
          opacity={0.85}
        />
      ) : (
        <Rect
          width={unit.width * px}
          height={unit.height * px}
          fill={unit.fill}
          stroke={isSelected ? COLOURS.ACCENT : "transparent"}
          strokeWidth={2}
          cornerRadius={0}
          opacity={0.85}
        />
      )}

      {/* UNIT NAME */}
      <Text
        x={0}
        y={0}
        width={unit.width * px}
        height={unit.height * px}
        padding={6}
        align="center"
        verticalAlign="middle"
        text={unit.name}
        fontSize={12}
        fontFamily="Inter, sans-serif"
        fontStyle="bold"
        fill="#fdf7f2"
        wrap="none"
        ellipsis
        shadowColor="black"
        shadowOpacity={0.35}
        shadowBlur={3}
        shadowOffset={{ x: 0, y: 1 }}
        listening={false}
      />
    </Group>
  );
}
