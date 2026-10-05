import { buildRectShape, getTransformedBounds } from "/imports/api/locations/shapeUtils";
import { CANVAS_CONFIG } from "../CanvasConfig";
import { COLOURS } from "../../FloorMapStyles";

export function normalizeFloorSize(floorSize) {
  const width = Number(floorSize?.width);
  const height = Number(floorSize?.height);
  // Older floor maps (including the seeded maps) have no saved dimensions.
  // The full canvas displays them at its default size, so previews must too.
  if (!(width > 0 && height > 0)) return { ...CANVAS_CONFIG.DEFAULT_FLOOR_SIZE };

  const looksLikeMeters = width <= 100 && height <= 100;
  return looksLikeMeters
    ? {
        width: width * CANVAS_CONFIG.PIXELS_PER_METER,
        height: height * CANVAS_CONFIG.PIXELS_PER_METER,
      }
    : { width, height };
}

/** Use the same transformed unit bounds in the editor and read-only previews. */
export function mapStorageUnitToCanvasUnit(unit) {
  const shape =
    Array.isArray(unit.shape?.points) && unit.shape.points.length >= 3
      ? unit.shape
      : buildRectShape({
          width: Number(unit.width) > 0 ? Number(unit.width) : 1,
          height: Number(unit.height) > 0 ? Number(unit.height) : 1,
          name: unit.name || "Storage unit",
        });
  const offset = unit.offset ?? { x: 0, y: 0 };
  const scale = unit.scale ?? { x: 1, y: 1 };
  const bounds = getTransformedBounds(shape, { offset, rotation: unit.rotation, scale });
  return {
    id: unit._id,
    _id: unit._id,
    name: unit.name,
    type: unit.type,
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    shape,
    offset,
    rotation: unit.rotation ?? 0,
    scale: unit.scale,
    fill: unit.fill || COLOURS.UNIT_DEFAULT,
  };
}
