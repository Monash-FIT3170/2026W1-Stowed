import { isRectRectIntersecting } from "./UnitCollisions";
import { CANVAS_CONFIG }          from "../../components/Canvas";

/**
 * Converts all units (except excludeId) to pixel-space bounds objects
 *
 * @param {Object[]}    units
 * @param {string|null} excludeId - Unit to omit, typically the one being moved
 * 
 * @returns {{ dom: { lower: number, upper: number }, ran: { lower: number, upper: number } }[]}
 */
export function getOtherUnitBounds(units, excludeId = null) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  return units
    .filter((u) => u.id !== excludeId)
    .map(({ x, y, width: w, height: h }) => ({
      dom: { lower: x * px,       upper: (x + w) * px },
      ran: { lower: y * px,       upper: (y + h) * px },
    }));
}

/**
 * Returns true if newBounds intersects any existing unit on the canvas.
 *
 * @param {{ dom: { lower: number, upper: number }, ran: { lower: number, upper: number } }} newBounds
 * @param {Object[]}    units
 * @param {string|null} excludeId - Unit to ignore during collision check (e.g. the unit being dragged).
 * 
 * @returns {boolean}
 */
export function hasCollisions(newBounds, units, excludeId = null) {
  const intersectsThis = isRectRectIntersecting(newBounds);
  return getOtherUnitBounds(units, excludeId)
    .map((other) => intersectsThis(other))
    .reduce((acc, i) => acc || i, false);
}