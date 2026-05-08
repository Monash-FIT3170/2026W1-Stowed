import { isRectRectIntersecting } from "./UnitCollisions";
import { CANVAS_CONFIG } from "../../components/Canvas";

export function getOtherUnitBounds(units, excludeId = null) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  return units
    .filter((u) => u.id !== excludeId)
    .map(({ x, y, width: w, height: h }) => ({
      dom: { lower: x * px,       upper: (x + w) * px },
      ran: { lower: y * px,       upper: (y + h) * px },
    }));
}

export function hasCollisions(newBounds, units, excludeId = null) {
  const intersectsThis = isRectRectIntersecting(newBounds);
  return getOtherUnitBounds(units, excludeId)
    .map((other) => intersectsThis(other))
    .reduce((acc, i) => acc || i, false);
}