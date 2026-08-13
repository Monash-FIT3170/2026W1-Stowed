// imports/api/locations/shapeUtils.js
//
// Shared helpers for building/reading Unit Shapes

export const CUSTOM_RECT_SHAPE_ID = -1;

/**
 * Builds a axis-aligned, CCW-wound rectangle with an anchor at (0,0).
 *
 * @param {{ width: number, height: number, name?: string, shapeId?: number, gridReference?: {x: number, y: number} }} params
 * @returns {Object} a shape matching UnitShapeSchema
 */
export function buildRectShape({
  width,
  height,
  name = "Rectangle",
  shapeId = CUSTOM_RECT_SHAPE_ID,
  gridReference = { x: 0, y: 0 },
}) {
  return {
    shapeId,
    name,
    gridReference,
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
  };
}

/**
 * Applies a StorageUnit's transformation to a shape's local points,
 * returning them in floor-map co space.
 *
 * @param {{ points: {x: number, y: number}[] }} shape
 * @param {{ offset?: {x: number, y: number}, rotation?: number, scale?: {x: number, y: number} }} transform
 * @returns {{ x: number, y: number }[]}
 */
export function transformPoints(
  shape,
  { offset = { x: 0, y: 0 }, rotation = 0, scale = { x: 1, y: 1 } } = {},
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const sx = scale?.x ?? 1;
  const sy = scale?.y ?? 1;
  const ox = offset?.x ?? 0;
  const oy = offset?.y ?? 0;

  return shape.points.map((p) => {
    const scaledX = p.x * sx;
    const scaledY = p.y * sy;
    return {
      x: scaledX * cos - scaledY * sin + ox,
      y: scaledX * sin + scaledY * cos + oy,
    };
  });
}

/**
 * Axis-aligned bounding box of a set of world space points.
 *
 * @param {{ x: number, y: number }[]} points
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
 */
export function getBoundingBox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Transforma  shape's points by a StorageUnit's placement.
 * Then take the bounding box of the result.
 * @param {{ points: {x: number, y: number}[] }} shape
 * @param {{ offset?: {x: number, y: number}, rotation?: number, scale?: {x: number, y: number} }} transform
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
 */
export function getTransformedBounds(shape, transform) {
  return getBoundingBox(transformPoints(shape, transform));
}
