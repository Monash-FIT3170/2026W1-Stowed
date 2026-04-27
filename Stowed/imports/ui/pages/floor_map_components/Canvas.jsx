import {Stage, Layer, Rect, Line, Text} from "react-konva";
import { COLOURS } from "../../Colours";

export const CANVAS_CONFIG = {
  METERS_PER_CELL : 1,
  PIXELS_PER_METER : 50,
  GRID_SIZE : 50 * 1
}

export function Canvas({ style, floorSize, activeTool }) {
  const width = floorSize.width;
  const height = floorSize.height;
  const gridSize = CANVAS_CONFIG.GRID_SIZE;
  const metersPerCell = CANVAS_CONFIG.METERS_PER_CELL;

  // build grids
  const vLines = [];
  for (let x = 0; x <= width; x += gridSize) {
    
    if (x === 0) {
      continue;
    }
    
    const meters = (x / gridSize) * metersPerCell;

    // line
    vLines.push(<Line key={`v-${x}`} points={[x, 0, x, height]} stroke="#ccc" strokeWidth={1}/>);
    // label
    vLines.push(<Text key={`vl-${x}`} x={x + 3} y={4} text={`${meters}m`} fontSize={10} fill={CANVAS_CONFIG.TEXT_COLOUR}/>);
  }


  const hLines=[]
  for (let y = 0; y <= height; y += gridSize) {

    if (y === 0) {
      continue;
    }
    
    const meters = (y / gridSize) * metersPerCell;

    // line
    hLines.push(<Line key={`h-${y}`} points={[0, y, width, y]} stroke="#ccc" strokeWidth={1}/>);

    // label
      hLines.push(<Text key={`hl-${y}`} x={4} y={y + 3} text={`${meters}m`} fontSize={10} fill={CANVAS_CONFIG.TEXT_COLOUR}/>);
  }

  return (
    <Stage ref={null} width={width} height={height} style={style}>
      {/* GRID LAYER - use different layer for objects*/}
      <Layer>
        {/* BACKGROUND */}
        <Rect x={0} y={0} width={width} height={height} fill={COLOURS.CANVAS_FILL}
        />

        {/* GRID LINES */}
        {vLines}
        {hLines}
      </Layer>
    </Stage>
  );
}
