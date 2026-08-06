import { buttonStyles, customShapesPanelStyles } from "./FloorMapStyles";

export function CustomShapesPanel({
  mapShapes = [],
  activeTool,
  setActiveTool,
}) {
  const getToolName = (shape) => `shape-${shape.shapeId}`;

  const getShapeButtonStyle = (toolName) => ({
    ...buttonStyles.base,
    ...buttonStyles.secondary,
    ...customShapesPanelStyles.shapeButton,
    ...(activeTool === toolName ? buttonStyles.active : {}),
  });

  return (
    <div style={customShapesPanelStyles.container}>
      <p style={customShapesPanelStyles.title}>Custom Shapes</p>

      {mapShapes.length === 0 ? (
        <div style={customShapesPanelStyles.emptyState}>
          No custom shapes created
        </div>
      ) : (
        <div style={customShapesPanelStyles.list}>
          {mapShapes.map((shape) => {
            const toolName = getToolName(shape);

            return (
              <button
                key={shape._id}
                type="button"
                onClick={() => setActiveTool(toolName)}
                style={getShapeButtonStyle(toolName)}
                aria-pressed={activeTool === toolName}
              >
                <span style={customShapesPanelStyles.shapeName}>
                  {shape.name}
                </span>

      
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}