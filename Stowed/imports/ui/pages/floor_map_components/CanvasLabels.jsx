import { COLOURS } from "../../Colours";


export function CanvasLabels({width, height, gridSize}) {
    /**
     * Adds grid labels to canvas
     */
    const labels = [];
  
    for (let i=0; i<=width; i+=gridSize) {
      labels.push(
        <div
          key={`x-${i}`}
          style={{
            position: "absolute",
            left: i,
            top: -20,
            fontSize: 10,
            color: COLOURS.CANVAS_LABEL,
          }}
        >
          {i / gridSize}m
        </div>
      );
    }
  
    for (let j=0; j<=height; j+=gridSize) {
      labels.push(
        <div
          key={`y-${j}`}
          style={{
            position: "absolute",
            left: -25,
            top: j,
            fontSize: 10,
            color: COLOURS.CANVAS_LABEL,
          }}
        >
          {j / gridSize}m
        </div>
      );
    }
  
    return <>{labels}</>; 
  }
  