import { Layer } from "react-konva";
import { StorageUnit } from "../units/StorageUnit";

/**
 * Renders all StorageUnit components onto a Konva Layer.
 *
 * @param {Object[]}                                     units
 * @param {Set<string>}                                  selectedIds
 * @param {boolean}                                      isCanvasEditMode
 * @param {(id: string) => React.RefObject<Konva.Group>} getGroupRef
 * @param {(unit, e) => void}                            onUnitClick
 * @param {(e, id: string) => void}                      onDragMove
 * @param {(e, id: string) => void}                      onDragEnd
 * @param {(e, unit) => void}                            onTransformEnd
 * @param {number}                                       [opacity=1] - Opacity of the whole layer
 *
 * @returns {JSX.Element}
 */
export function UnitLayer({
  units,
  selectedIds,
  isCanvasEditMode,
  getGroupRef,
  onUnitClick,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  opacity = 1,
}) {
  return (
    <Layer opacity={opacity}>
      {units.map((unit) => {
        const ref = getGroupRef(unit.id);
        return (
          <StorageUnit
            key={unit.id}
            unit={unit}
            isSelected={selectedIds.has(unit.id)}
            isCanvasEditMode={isCanvasEditMode}
            onSelect={(e) => onUnitClick(unit, e)}
            onDragMove={(e) => onDragMove(e, unit.id)}
            onDragEnd={(e) => onDragEnd(e, unit.id)}
            onTransformEnd={(e) => onTransformEnd(e, unit)}
            groupRef={(node) => {
              ref.current = node;
            }}
          />
        );
      })}
    </Layer>
  );
}
