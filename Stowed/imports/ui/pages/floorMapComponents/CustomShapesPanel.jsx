import { buttonStyles, COLOURS, customShapesPanelStyles } from "./FloorMapStyles";
import { dragState } from "./canvas/editor/DragState";
import { getShapeBounds, normaliseShapePoints } from "./canvas/editor/utils/ShapeGeometry";
import { useEditor } from "./canvas/editor/EditorContext";
import { CANVAS_CONFIG } from "./canvas/CanvasConfig";
import { hasCollisions } from "./canvas/editor/utils/Collisions";
import { FloorMapIcon } from "./FloorMapIcon";

const presetShapes = [
  {
    shapeId: -1,
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
    shapeId: -2,
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
    shapeId: -3,
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
    shapeId: -4,
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

function createDraftUnitId() {
  return `unit-${Date.now()}-${Math.random()}`;
}

function ShapePreview({ points = [] }) {
  if (!points.length) return null;

  const normalisedPoints = normaliseShapePoints(points);
  const { width, height } = getShapeBounds(normalisedPoints);

  const safeWidth = width || 1;
  const safeHeight = height || 1;

  const padding = 4;
  const previewSize = 28;

  const availableSize = previewSize - padding * 2;

  const scale = Math.min(availableSize / safeWidth, availableSize / safeHeight);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const offsetX = (previewSize - scaledWidth) / 2;
  const offsetY = (previewSize - scaledHeight) / 2;

  const polygonPoints = normalisedPoints
    .map((point) => `${point.x * scale + offsetX},${point.y * scale + offsetY}`)
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
  isChangingShape,
  onChangeShape,
  mobile = false,
  onShapeAdded,
}) {
  const { handleUnitPlaced, units, commitUnits, floorSize } = useEditor();

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
    handleUnitPlaced(true); // save the layout to get the new unit in the DB
    dragState.template = null;
  }

  function handleAddShape(shape) {
    const template = buildShapeTemplate(shape);
    const maxX = floorSize.width / CANVAS_CONFIG.PIXELS_PER_METER - template.width;
    const maxY = floorSize.height / CANVAS_CONFIG.PIXELS_PER_METER - template.height;
    for (let y = 0; y <= maxY; y += 0.5) {
      for (let x = 0; x <= maxX; x += 0.5) {
        const candidate = { ...template, id: createDraftUnitId(), x, y };
        if (!hasCollisions(candidate, units)) {
          commitUnits((current) => [...current, candidate]);
          setActiveTool(getToolName(shape));
          onShapeAdded?.(candidate);
          return;
        }
      }
    }
    window.alert("There is no room for this shape on the floor map.");
  }

  return (
    <div style={customShapesPanelStyles.container}>
      {mobile && !isChangingShape && (
        <p className="floor-map-panel-hint">Tap a shape to place it on the map.</p>
      )}
      {/* PRESET SHAPES */}
      <p style={customShapesPanelStyles.title}>Preset Shapes</p>

      <div style={customShapesPanelStyles.list}>
        {presetShapes.map((shape) => {
          const toolName = getToolName(shape);

          return (
            <div className="floor-map-template-row" key={shape.shapeId}>
              <button
                type="button"
                draggable={!isChangingShape && !mobile}
                onDragStart={(event) => handleDragStart(event, shape)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (isChangingShape) onChangeShape(shape);
                  else if (mobile) handleAddShape(shape);
                  else setActiveTool(toolName);
                }}
                style={{
                  ...getShapeButtonStyle(toolName),
                  cursor: mobile ? "pointer" : "grab",
                }}
                aria-pressed={mobile ? undefined : activeTool === toolName}
                aria-label={mobile && !isChangingShape ? `Add ${shape.name} to map` : undefined}
              >
                <div style={customShapesPanelStyles.shapeButtonContent}>
                  <ShapePreview points={shape.points} />

                  <span style={customShapesPanelStyles.shapeName}>{shape.name}</span>
                  {mobile && !isChangingShape && <FloorMapIcon name="plus" size={17} />}
                </div>
              </button>
              {!isChangingShape && !mobile && (
                <button
                  type="button"
                  className="floor-map-template-add"
                  onClick={() => handleAddShape(shape)}
                  aria-label={`Add ${shape.name} to map`}
                >
                  <FloorMapIcon name="plus" size={16} />
                  <span>Add</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* CUSTOM SHAPES */}
      <div style={{ marginTop: 12 }}>
        <p style={customShapesPanelStyles.title}>Custom Shapes</p>
      </div>

      {mapShapes.length === 0 ? (
        <div style={customShapesPanelStyles.emptyState}>No custom shapes created</div>
      ) : (
        <div style={customShapesPanelStyles.list}>
          {mapShapes.map((shape) => {
            const toolName = getToolName(shape);

            return (
              <div
                key={shape._id}
                className="floor-map-template-row"
                style={customShapesPanelStyles.shapeRow}
              >
                <button
                  type="button"
                  draggable={!isChangingShape && !mobile}
                  onDragStart={(event) => handleDragStart(event, shape)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (isChangingShape) onChangeShape(shape);
                    else if (mobile) handleAddShape(shape);
                    else setActiveTool(toolName);
                  }}
                  style={{
                    ...getShapeButtonStyle(toolName),
                    cursor: mobile ? "pointer" : "grab",
                    flex: 1,
                  }}
                  aria-pressed={mobile ? undefined : activeTool === toolName}
                  aria-label={mobile && !isChangingShape ? `Add ${shape.name} to map` : undefined}
                >
                  <div style={customShapesPanelStyles.shapeButtonContent}>
                    <ShapePreview points={shape.points} />

                    <span style={customShapesPanelStyles.shapeName}>{shape.name}</span>
                    {mobile && !isChangingShape && <FloorMapIcon name="plus" size={17} />}
                  </div>
                </button>

                {!isChangingShape && !mobile && (
                  <button
                    type="button"
                    className="floor-map-template-add"
                    onClick={() => handleAddShape(shape)}
                    aria-label={`Add ${shape.name} to map`}
                  >
                    <FloorMapIcon name="plus" size={16} />
                    <span>Add</span>
                  </button>
                )}

                {!isChangingShape && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEditShape(shape)}
                      aria-label={`Edit ${shape.name} template`}
                      style={customShapesPanelStyles.editButton}
                    >
                      <FloorMapIcon name="edit" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteShape(shape)}
                      aria-label={`Delete ${shape.name} template`}
                      style={customShapesPanelStyles.editButton}
                    >
                      <FloorMapIcon name="trash" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
