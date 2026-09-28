import { Layer, Rect } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";

export function WalkwayLayer({
  walkwayCells,
  selectedWalkwayId,
  getWalkwayRef,
  onWalkwayClick,
  onTransformEnd,
  isAddingWalkway
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  return (
    <Layer>
      {walkwayCells.map((walkway) => (
        <Rect
          key={walkway.id}

          ref={(node) => {
            getWalkwayRef(walkway.id).current = node;
          }}

          x={walkway.x * px}
          y={walkway.y * px}
          width={walkway.width * px}
          height={walkway.height * px}

          fill="#cbd5e1"

          stroke={
            selectedWalkwayId === walkway.id
              ? "#2563eb"
              : "#94a3b8"
          }

          strokeWidth={
            selectedWalkwayId === walkway.id ? 2 : 1
          }

          draggable={false}

          onClick={(e) => {
            if (isAddingWalkway) {
              return;
            }

            e.cancelBubble = true;
            onWalkwayClick(walkway);
          }}

          onTransformEnd={(e) =>
            onTransformEnd(e, walkway)
          }
        />
      ))}
    </Layer>
  );
}