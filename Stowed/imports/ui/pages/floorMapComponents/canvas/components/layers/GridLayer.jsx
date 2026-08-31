import { Layer, Rect, Line, Text } from "react-konva";
import { COLOURS } from "../../../FloorMapStyles";
import { CANVAS_CONFIG } from "../../CanvasConfig";

/**
 * Renders a grid onto the Konva canvas
 *
 * @param {number}  width
 * @param {number}  height
 * @param {number}  gridSizePx
 * @param {boolean} showGrid
 *
 * @returns {JSX.Element} A Konva <Layer> containing a grid or no grid
 */
export function GridLayer({ width, height, gridSizePx, showGrid }) {
  const { vLines, hLines } = getGridLines({ width, height, gridSizePx, showGrid });

  return (
    <Layer imageSmoothingEnabled={false} listening={false}>
      {/* BACKGROUND */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={COLOURS.CANVAS_FILL}
        shadowColor="black"
        shadowBlur={16}
        shadowOpacity={0.18}
        shadowOffset={{ x: 0, y: 0 }}
      />

      {/* GRID LINES */}
      {vLines}
      {hLines}
    </Layer>
  );
}

let cachedKey = null;
let cachedLines = null;

function getGridLines({ width, height, gridSizePx, showGrid }) {
  const key = `${width}|${height}|${gridSizePx}|${showGrid}`;
  if (key === cachedKey) return cachedLines;

  cachedKey = key;
  cachedLines = buildGridLines({ width, height, gridSizePx, showGrid });
  return cachedLines;
}

function buildGridLines({ width, height, gridSizePx, showGrid }) {
  const vLines = [];
  const hLines = [];

  if (showGrid) {
    for (let x = 0; x <= width; x += gridSizePx) {
      if (x === 0) continue;
      const meters = x / CANVAS_CONFIG.PIXELS_PER_METER;
      vLines.push(
        <Line
          key={`v-${x}`}
          points={[x, 0, x, height]}
          stroke={COLOURS.CANVAS_GRID}
          strokeWidth={1}
          dash={[4, 4]}
          strokeScaleEnabled={false}
        />,
      );

      if (meters % 1 == 0) {
        vLines.push(
          <Text
            key={`vl-${x}`}
            x={x - 23}
            y={4}
            text={`${meters}m`}
            fontSize={10}
            fill={COLOURS.CANVAS_LABEL}
          />,
        );
      } else {
        vLines.push(
          <Text
            key={`vl-${x}`}
            x={x - 23}
            y={4}
            text={``}
            fontSize={10}
            fill={COLOURS.CANVAS_LABEL}
          />,
        );
      }
    }
    for (let y = 0; y <= height; y += gridSizePx) {
      if (y === 0) continue;
      const meters = y / CANVAS_CONFIG.PIXELS_PER_METER;
      hLines.push(
        <Line
          key={`h-${y}`}
          points={[0, y, width, y]}
          stroke={COLOURS.CANVAS_GRID}
          strokeWidth={1}
          dash={[4, 4]}
          strokeScaleEnabled={false}
        />,
      );

      if (meters % 1 == 0) {
        hLines.push(
          <Text
            key={`hl-${y}`}
            x={4}
            y={y - 12}
            text={`${meters}m`}
            fontSize={10}
            fill={COLOURS.CANVAS_LABEL}
          />,
        );
      } else {
        hLines.push(
          <Text
            key={`hl-${y}`}
            x={4}
            y={y - 12}
            text={``}
            fontSize={10}
            fill={COLOURS.CANVAS_LABEL}
          />,
        );
      }
    }
  }

  return { vLines, hLines };
}
