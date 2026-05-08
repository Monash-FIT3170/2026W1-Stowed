import { Layer } from "react-konva";
import { StorageUnit } from "../units/StorageUnit";

export function UnitLayer({
  units,
  selectedIds,
  activeTool,
  getGroupRef,
  onUnitClick,
  onDragMove,
  onDragEnd,
  onTransformEnd,
}) {
  return (
    <Layer>
      {units.map((unit) => {
        const ref = getGroupRef(unit.id);
        return (
          <StorageUnit
            key={unit.id}
            unit={unit}
            isSelected={selectedIds.has(unit.id)}
            activeTool={activeTool}
            onSelect={(e) => onUnitClick(unit, e)}
            onDragMove={(e) => onDragMove(e, unit.id)}
            onDragEnd={(e) => onDragEnd(e, unit.id)}
            onTransformEnd={(e) => onTransformEnd(e, unit)}
            groupRef={(node) => { ref.current = node; }}
          />
        );
      })}
    </Layer>
  );
}