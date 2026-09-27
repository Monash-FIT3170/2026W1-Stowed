import { Layer, Rect } from "react-konva";

export function WalkwayLayer({
  walkwayCells,
  gridSizePx,
}) {
  return (
    <Layer listening={false}>
      {walkwayCells.map((cell) => (
        <Rect
          key={`${cell.row}-${cell.col}`}
          x={cell.col * gridSizePx}
          y={cell.row * gridSizePx}
          width={gridSizePx}
          height={gridSizePx}
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={1}
        />
      ))}
    </Layer>
  );
}