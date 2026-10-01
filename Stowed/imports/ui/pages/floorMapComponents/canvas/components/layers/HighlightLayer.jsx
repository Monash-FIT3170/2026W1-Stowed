import { Layer, Line, Rect } from "react-konva";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { COLOURS } from "../../../FloorMapStyles";
import { flattenPoints, isDrawnShape } from "../units/StorageUnit";

/**
 * Draws a temporary accent ring over one unit, used by the detail page's
 * "Show on map" to point at the unit a searched product sits in.
 *
 * Purely decorative - listening is off so it never steals clicks from the
 * layers underneath.
 *
 * @param {Array} units
 * @param {string|null} highlightedUnitId
 */
export function HighlightLayer({ units, highlightedUnitId }) {
  if (!highlightedUnitId) return null;

  const unit = units.find((candidate) => (candidate._id || candidate.id) === highlightedUnitId);
  if (!unit) return null;

  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  const outline = {
    stroke: COLOURS.ACCENT,
    strokeWidth: 3,
    fill: "rgba(181, 83, 42, 0.18)",
    shadowColor: COLOURS.ACCENT,
    shadowBlur: 18,
    shadowOpacity: 0.9,
    listening: false,
  };

  return (
    <Layer listening={false}>
      {isDrawnShape(unit) ? (
        <Line
          x={unit.x * px}
          y={unit.y * px}
          points={flattenPoints(unit)}
          closed
          {...outline}
        />
      ) : (
        <Rect
          x={unit.x * px}
          y={unit.y * px}
          width={unit.width * px}
          height={unit.height * px}
          cornerRadius={4}
          {...outline}
        />
      )}
    </Layer>
  );
}
