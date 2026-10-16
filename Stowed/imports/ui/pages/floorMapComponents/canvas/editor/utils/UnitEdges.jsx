import { getUnitPolygon } from "./Collisions";

/**
 * Returns the closest point to `point` on the line segment from `a` to `b`.
 *
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 *
 * @returns {{ x: number, y: number }}
 */
export function closestPointOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return { x: a.x, y: a.y };

  // Project the point onto the segment, clamped to its ends
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * Clips the line segment from `a` to `b` to the inside of an axis-aligned rectangle
 * (Liang-Barsky). Returns the part of the segment inside the rectangle, or null if none is.
 *
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 *
 * @returns {[{ x: number, y: number }, { x: number, y: number }] | null}
 */
export function clipSegmentToBounds(a, b, bounds) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let tStart = 0;
  let tEnd = 1;

  // Each pair is (p, q) for one side of the rectangle: the segment is inside while p*t <= q
  const sides = [
    [-dx, a.x - bounds.minX],
    [dx, bounds.maxX - a.x],
    [-dy, a.y - bounds.minY],
    [dy, bounds.maxY - a.y],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return null; // parallel to this side and outside it
      continue;
    }
    const t = q / p;
    if (p < 0) tStart = Math.max(tStart, t);
    else tEnd = Math.min(tEnd, t);
    if (tStart > tEnd) return null;
  }

  return [
    { x: a.x + tStart * dx, y: a.y + tStart * dy },
    { x: a.x + tEnd * dx, y: a.y + tEnd * dy },
  ];
}

/**
 * Finds the closest point on any unit's outline to the given point.
 * All values are in metres, matching unit placement.
 *
 * @param {{ x: number, y: number }} point
 * @param {Object[]}                 units       - Canvas units (see getUnitPolygon)
 * @param {number}                   maxDistance - Ignore edges further away than this
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} [bounds]
 *   Only consider the parts of each edge inside this area (e.g. away from the floor boundary)
 *
 * @returns {{ x: number, y: number, unit: Object } | null} The edge point and the unit it belongs to
 */
export function findNearestUnitEdgePoint(point, units, maxDistance, bounds = null) {
  let best = null;
  let bestDistance = maxDistance;

  for (const unit of units) {
    const polygon = getUnitPolygon(unit);
    for (let i = 0; i < polygon.length; i++) {
      let start = polygon[i];
      let end = polygon[(i + 1) % polygon.length];
      if (bounds) {
        const clipped = clipSegmentToBounds(start, end, bounds);
        if (!clipped) continue; // this edge lies entirely outside the allowed area
        [start, end] = clipped;
      }

      const edgePoint = closestPointOnSegment(point, start, end);
      const distance = Math.hypot(edgePoint.x - point.x, edgePoint.y - point.y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { x: edgePoint.x, y: edgePoint.y, unit };
      }
    }
  }

  return best;
}
