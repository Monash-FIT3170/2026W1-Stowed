import { buttonStyles, COLOURS, customShapesPanelStyles } from "./FloorMapStyles";
import { dragState } from "./canvas/editor/DragState";
import { getShapeBounds, normaliseShapePoints } from "./canvas/editor/utils/ShapeGeometry";

export function CustomShapesPanel({ mapShapes = [], activeTool, setActiveTool }) {
  const getToolName = (shape) => `shape-${shape.shapeId}`;

  const getShapeButtonStyle = (toolName) => ({
    ...buttonStyles.base,
    ...buttonStyles.secondary,
    ...customShapesPanelStyles.shapeButton,
    ...(activeTool === toolName ? buttonStyles.active : {}),
  });

  function buildShapeTemplate(shape) {
    const normalisedPoints = normaliseShapePoints(shape.points);
    const { width, height } = getShapeBounds(normalisedPoints);

    return {
      name: shape.name,
      type: "custom",

      shape: {
        orgId: shape.orgId,
        shapeId: shape.shapeId,
        name: shape.name,
        points: normalisedPoints,
        gridReference: shape.gridReference ?? {
          x: 0,
          y: 0,
        },
      },

      width,
      height,
      fill: COLOURS.UNIT_DEFAULT,

      rotation: 0,

      scale: {
        x: 1,
        y: 1,
      },
    };
  }

  function handleDragStart(event, shape) {
    const template = buildShapeTemplate(shape);

    event.dataTransfer.setData("unit", JSON.stringify(template));

    dragState.template = template;

    event.dataTransfer.effectAllowed = "copy";
  }

  function handleDragEnd() {
    dragState.template = null;
  }

  return (
    <div style={customShapesPanelStyles.container}>
      <p style={customShapesPanelStyles.title}>Custom Shapes</p>

      {mapShapes.length === 0 ? (
        <div style={customShapesPanelStyles.emptyState}>No custom shapes created</div>
      ) : (
        <div style={customShapesPanelStyles.list}>
          {mapShapes.map((shape) => {
            const toolName = getToolName(shape);

            return (
              <button
                key={shape._id}
                type="button"
                draggable
                onDragStart={(event) => handleDragStart(event, shape)}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveTool(toolName)}
                style={{
                  ...getShapeButtonStyle(toolName),
                  cursor: "grab",
                }}
                aria-pressed={activeTool === toolName}
              >
                <span style={customShapesPanelStyles.shapeName}>{shape.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
