import { Layer, Rect } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";

export function WalkwayLayer({
  walkwayCells,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  return (
    <Layer listening={false}>
      {walkwayCells.map((cell, index) => (
        <Rect
          key={`${cell.x}-${cell.y}-${index}`}
          x={cell.x * px}
          y={cell.y * px}
          width={cell.width * px}
          height={cell.height * px}
          fill="#cbd5e1"
        />
      ))}
    </Layer>
  );
}