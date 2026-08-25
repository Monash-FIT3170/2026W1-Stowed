import { buttonStyles, customShapesPanelStyles } from "./FloorMapStyles";
import { dragState } from "./canvas/editor/DragState";
import {
  getShapeBounds,
  normaliseShapePoints,
} from "./canvas/editor/utils/ShapeGeometry";

const presetShapes = [
  {
    shapeId: "preset-square",
    name: "Square",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    gridReference: {
      x: 0,
      y: 0,
    },
    isPreset: true,
  },

  {
    shapeId: "preset-rectangle",
    name: "Rectangle",
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ],
    gridReference: {
      x: 0,
      y: 0,
    },
    isPreset: true,
  },

  {
    shapeId: "preset-triangle",
    name: "Triangle",
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ],
    gridReference: {
      x: 0,
      y: 0,
    },
    isPreset: true,
  },

  {
    shapeId: "preset-l-shape",
    name: "L Shape",
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    gridReference: {
      x: 0,
      y: 0,
    },
    isPreset: true,
  },
];

function ShapePreview({ points = [] }) {
  if (!points.length) return null;

  const normalisedPoints = normaliseShapePoints(points);
  const { width, height } = getShapeBounds(normalisedPoints);

  const safeWidth = width || 1;
  const safeHeight = height || 1;

  const padding = 4;
  const previewSize = 28;

  const availableSize = previewSize - padding * 2;

  const scale = Math.min(
    availableSize / safeWidth,
    availableSize / safeHeight,
  );

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const offsetX = (previewSize - scaledWidth) / 2;
  const offsetY = (previewSize - scaledHeight) / 2;

  const polygonPoints = normalisedPoints
    .map(
      (point) =>
        `${point.x * scale + offsetX},${point.y * scale + offsetY}`,
    )
    .join(" ");

  return (
    <svg
      width={previewSize}
      height={previewSize}
      viewBox={`0 0 ${previewSize} ${previewSize}`}
      style={customShapesPanelStyles.shapePreview}
      aria-hidden="true"
    >
      <polygon
        points={polygonPoints}
        fill="#7a5230"
        stroke="#7a5230"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CustomShapesPanel({
  mapShapes = [],
  activeTool,
  setActiveTool,
  onEditShape,
  onDeleteShape,
}) {
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
      fill: "#7a5230",

      rotation: 0,

      scale: {
        x: 1,
        y: 1,
      },
    };
  }

  function handleDragStart(event, shape) {
    const template = buildShapeTemplate(shape);

    event.dataTransfer.setData(
      "unit",
      JSON.stringify(template),
    );

    dragState.template = template;

    event.dataTransfer.effectAllowed = "copy";
  }

  function handleDragEnd() {
    dragState.template = null;
  }

  return (
    <div style={customShapesPanelStyles.container}>
      {/* PRESET SHAPES */}
      <p style={customShapesPanelStyles.title}>
        Preset Shapes
      </p>

      <div style={customShapesPanelStyles.list}>
        {presetShapes.map((shape) => {
          const toolName = getToolName(shape);

          return (
            <button
              key={shape.shapeId}
              type="button"
              draggable
              onDragStart={(event) =>
                handleDragStart(event, shape)
              }
              onDragEnd={handleDragEnd}
              onClick={() => setActiveTool(toolName)}
              style={{
                ...getShapeButtonStyle(toolName),
                cursor: "grab",
              }}
              aria-pressed={activeTool === toolName}
            >
              <div style={customShapesPanelStyles.shapeButtonContent}>
                <ShapePreview points={shape.points} />

                <span style={customShapesPanelStyles.shapeName}>
                  {shape.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* CUSTOM SHAPES */}
      <div style={{ marginTop: 12 }}>
        <p style={customShapesPanelStyles.title}>
          Custom Shapes
        </p>
      </div>

      {mapShapes.length === 0 ? (
        <div style={customShapesPanelStyles.emptyState}>
          No custom shapes created
        </div>
      ) : (
        <div style={customShapesPanelStyles.list}>
          {mapShapes.map((shape) => {
            const toolName = getToolName(shape);

            return (
              <div
                key={shape._id}
                style={customShapesPanelStyles.shapeRow}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={(event) =>
                    handleDragStart(event, shape)
                  }
                  onDragEnd={handleDragEnd}
                  onClick={() =>
                    setActiveTool(toolName)
                  }
                  style={{
                    ...getShapeButtonStyle(toolName),
                    cursor: "grab",
                    flex: 1,
                  }}
                  aria-pressed={
                    activeTool === toolName
                  }
                >
                  <div style={customShapesPanelStyles.shapeButtonContent}>
                    <ShapePreview points={shape.points} />

                    <span style={customShapesPanelStyles.shapeName}>
                      {shape.name}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onEditShape(shape)}
                  style={
                    customShapesPanelStyles.editButton
                  }
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                    <path fill="currentColor" d="m14.06 9.02l.92.92L5.92 19H5v-.92zM17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83l3.75 3.75l1.83-1.83a.996.996 0 0 0 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29m-3.6 3.19L3 17.25V21h3.75L17.81 9.94z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteShape(shape)}
                  style={
                    customShapesPanelStyles.editButton
                  }
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 12 12">
                    <path fill="currentColor" d="M5 3h2a1 1 0 0 0-2 0M4 3a2 2 0 1 1 4 0h2.5a.5.5 0 0 1 0 1h-.441l-.443 5.17A2 2 0 0 1 7.623 11H4.377a2 2 0 0 1-1.993-1.83L1.941 4H1.5a.5.5 0 0 1 0-1zm3.5 3a.5.5 0 0 0-1 0v2a.5.5 0 0 0 1 0zM5 5.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5M3.38 9.085a1 1 0 0 0 .997.915h3.246a1 1 0 0 0 .996-.915L9.055 4h-6.11z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}