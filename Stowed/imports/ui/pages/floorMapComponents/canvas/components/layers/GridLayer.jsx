import { Layer, Rect, Line, Text } from "react-konva";
import { COLOURS } from "../../../floorMapStyles";
import { CANVAS_CONFIG } from "../Canvas";

export function GridLayer({ width, height, gridSizePx, showGrid }) {
  const vLines = [];
  const hLines = [];

  if (showGrid) {
    for (let x = 0; x <= width; x += gridSizePx) {
      if (x === 0) continue;
      const meters = x / CANVAS_CONFIG.PIXELS_PER_METER;
      vLines.push(<Line key={`v-${x}`} points={[x, 0, x, height]} stroke="#ccc" strokeWidth={1} />);
      vLines.push(<Text key={`vl-${x}`} x={x - 23} y={4} text={`${meters}m`} fontSize={10} fill="black" />);
    }
    for (let y = 0; y <= height; y += gridSizePx) {
      if (y === 0) continue;
      const meters = y / CANVAS_CONFIG.PIXELS_PER_METER;
      hLines.push(<Line key={`h-${y}`} points={[0, y, width, y]} stroke="#ccc" strokeWidth={1} />);
      hLines.push(<Text key={`hl-${y}`} x={4} y={y - 12} text={`${meters}m`} fontSize={10} fill="black" />);
    }
  }

  return (
    <Layer>
      {/* BACKGROUND */}
      <Rect x={0} y={0} width={width} height={height} fill={COLOURS.CANVAS_FILL} />

      {/* GRID LINES */}
      {vLines}
      {hLines}
    </Layer>
  );
}