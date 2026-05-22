import { Group, Rect, Text } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { COLOURS } from "../../../FloorMapStyles";

/**
 * Individual storage unit rendered as a labelled rectangle on the canvas.
 *
 * @param {Object}                  unit
 * @param {boolean}                 isSelected
 * @param {string}                  activeTool
 * @param {(e) => void}             onSelect
 * @param {(e) => void}             onDragMove
 * @param {(e) => void}             onDragEnd
 * @param {(e) => void}             onTransformEnd
 * @param {React.RefObject}         groupRef
 * 
 * @returns {JSX.Element}
 */
export function StorageUnit({ unit, isSelected, activeTool, onSelect, onDragMove, onDragEnd, onTransformEnd, groupRef}) {
  const canMove = activeTool === "move";
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  return (
    <Group ref={groupRef} id={unit.id} x={unit.x * px} y={unit.y * px} draggable={canMove} onClick={onSelect} onDragMove={onDragMove} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd}>
      {/* MAIN BODY */}
      <Rect
        width={unit.width * px}
        height={unit.height * px}
        fill={unit.fill}
        stroke={isSelected ? COLOURS.ACCENT : "transparent"}
        strokeWidth={2}
        cornerRadius={4}
        opacity={0.85}
      />
      {/* UNIT NAME */}
      <Text width={unit.width * px} height={unit.height * px} align="center" verticalAlign="middle" text={unit.name} fontSize={12} fill="white"/>
    </Group>
  );
}