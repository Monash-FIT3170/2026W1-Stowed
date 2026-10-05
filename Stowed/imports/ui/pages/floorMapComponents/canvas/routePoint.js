import { CANVAS_CONFIG } from "./CanvasConfig";

// Store route coordinates in metres, just like storage-unit positions.
export function getStartingPoint(stage, width, height) {
  const pointer = stage?.getPointerPosition();
  if (!pointer) return null;

  const x = (pointer.x - stage.x()) / stage.scaleX();
  const y = (pointer.y - stage.y()) / stage.scaleY();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > width || y > height) return null;

  return {
    x: x / CANVAS_CONFIG.PIXELS_PER_METER,
    y: y / CANVAS_CONFIG.PIXELS_PER_METER,
  };
}
