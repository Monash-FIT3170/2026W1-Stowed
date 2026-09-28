import { Layer, Transformer } from "react-konva";
import { useEffect, useRef } from "react";
import { CANVAS_CONFIG } from "../../CanvasConfig";

export function WalkwayTransformerLayer({
  selectedWalkwayId,
  getWalkwayRef,
}) {
  const transformerRef = useRef(null);

  useEffect(() => {
    if (!transformerRef.current) return;

    if (!selectedWalkwayId) {
      transformerRef.current.nodes([]);
      return;
    }

    const walkwayRef =
      getWalkwayRef(selectedWalkwayId);

    if (!walkwayRef.current) return;

    transformerRef.current.nodes([
      walkwayRef.current,
    ]);

    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedWalkwayId]);

  return (
    <Layer>
      <Transformer
        ref={transformerRef}

        rotateEnabled={false}

        enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
        ]}

        boundBoxFunc={(oldBox, newBox) => {
        const minPx = 0.5 * CANVAS_CONFIG.PIXELS_PER_METER;

        if (Math.abs(newBox.width) < minPx || Math.abs(newBox.height) < minPx) {
            return oldBox;
        }

        return newBox;
            }}
    />
    </Layer>
  );
}