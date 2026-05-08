import { Layer, Transformer } from "react-konva";
import { CANVAS_CONFIG }      from "../Canvas";

/**
 * Transformer layer that allows for dynamic resizing of storage units
 * 
 * @param {Set<string>} selectedIds
 * @param {(id: string) => React.RefObject<Konva.Group>}  getGroupRef - Lookup function that returns the Konva Group ref for a given unit id 
 * 
 * @returns {JSX.Element|null} A Konva Layer containing a Transformer or null if the selection count is not one
 */
export function TransformerLayer({ selectedIds, getGroupRef }) {
  // Only show transformer for a single selection
  if (selectedIds.size !== 1) return null;

  const nodes = [...selectedIds].map((id) => getGroupRef(id).current).filter(Boolean);

  if (nodes.length === 0) return null;

  return (
    <Layer>
      <Transformer
        nodes={nodes}
        rotateEnabled={false}
        keepRatio={false}
        boundBoxFunc={(oldBox, newBox) => {
          // Dissallow making storage units smaller than 0.5m
          const minPx = 0.5 * CANVAS_CONFIG.PIXELS_PER_METER;
          if (newBox.width < minPx || newBox.height < minPx) return oldBox;
          return newBox;
        }}
      />
    </Layer>
  );
}