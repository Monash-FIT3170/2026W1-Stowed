import { hasPolygonCollision } from "./UnitCollisions";

/**
 * Returns a unit's outline as world-space (metre) points: its custom shape
 * points if it has one, otherwise its axis-aligned width/height rectangle,
 * both offset by the unit's (x, y) placement.
 *
 * @param {{ x: number, y: number, width: number, height: number, type?: string, shape?: { points: {x: number, y: number}[] } }} unit
 * @returns {{ x: number, y: number }[]}
 */
function getUnitPolygon(unit) {
  const isCustomShape =
    unit.type === "custom" && Array.isArray(unit.shape?.points) && unit.shape.points.length >= 3;

  const localPoints = isCustomShape
    ? unit.shape.points
    : [
        { x: 0, y: 0 },
        { x: unit.width, y: 0 },
        { x: unit.width, y: unit.height },
        { x: 0, y: unit.height },
      ];

  return localPoints.map((p) => ({ x: p.x + unit.x, y: p.y + unit.y }));
}

/**
 * Returns true if proposedUnit's outline (rectangle or, for custom shapes,
 * its potentially non-convex polygon) overlaps any other unit on the canvas.
 *
 * @param {{ x: number, y: number, width: number, height: number, type?: string, shape?: { points: {x: number, y: number}[] } }} proposedUnit
 * @param {Object[]}    units
 * @param {string|null} excludeId - Unit to ignore during collision check (e.g. the unit being dragged).
 *
 * @returns {boolean}
 */
export function hasCollisions(proposedUnit, units, excludeId = null) {
  const newPoints = getUnitPolygon(proposedUnit);
  const candidates = units
    .filter((u) => u.id !== excludeId)
    .map((u) => ({ id: u.id, points: getUnitPolygon(u) }));

  return hasPolygonCollision(newPoints, candidates);
}
