import { Layer, Transformer } from "react-konva";
import { CANVAS_CONFIG } from "../Canvas";

export function TransformerLayer({ selectedIds, getGroupRef }) {
  // Only show transformer for a single selection
  if (selectedIds.size !== 1) return null;

  const nodes = [...selectedIds]
    .map((id) => getGroupRef(id).current)
    .filter(Boolean);

  if (nodes.length === 0) return null;

  return (
    <Layer>
      <Transformer
        nodes={nodes}
        rotateEnabled={false}
        keepRatio={false}
        boundBoxFunc={(oldBox, newBox) => {
          const minPx = 0.5 * CANVAS_CONFIG.PIXELS_PER_METER;
          if (newBox.width < minPx || newBox.height < minPx) return oldBox;
          return newBox;
        }}
      />
    </Layer>
  );
}