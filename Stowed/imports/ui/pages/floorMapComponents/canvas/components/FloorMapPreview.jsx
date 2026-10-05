import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Circle } from "react-konva";
import { CANVAS_CONFIG } from "../CanvasConfig";
import { mapStorageUnitToCanvasUnit, normalizeFloorSize } from "../editor/mapLayout";
import { COLOURS } from "../../FloorMapStyles";
import { GridLayer } from "./layers/GridLayer";
import { UnitLayer } from "./layers/UnitLayer";
import { HighlightLayer } from "./layers/HighlightLayer";

function hasPosition(unit) {
  return (
    Array.isArray(unit.shape?.points) &&
    unit.shape.points.length >= 3 &&
    unit.shape.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) &&
    Number.isFinite(unit.offset?.x) &&
    Number.isFinite(unit.offset?.y) &&
    Number.isFinite(unit.scale?.x ?? 1) &&
    Number.isFinite(unit.scale?.y ?? 1) &&
    Number.isFinite(unit.rotation ?? 0)
  );
}

/** Build one projection per floor map, even when several product locations share it. */
export function buildFloorMapPreviewModel(floorMap, storageUnits) {
  const floorSize = normalizeFloorSize(floorMap?.floorSize);
  if (!floorSize) return null;
  const floorWidthMeters = floorSize.width / CANVAS_CONFIG.PIXELS_PER_METER;
  const floorHeightMeters = floorSize.height / CANVAS_CONFIG.PIXELS_PER_METER;
  const units = storageUnits
    .filter((unit) => unit.floorMapId === floorMap._id && hasPosition(unit))
    .map(mapStorageUnitToCanvasUnit)
    .filter(
      (unit) =>
        [unit.x, unit.y, unit.width, unit.height].every(Number.isFinite) &&
        unit.width > 0 &&
        unit.height > 0 &&
        unit.x + unit.width / 2 >= 0 &&
        unit.x + unit.width / 2 <= floorWidthMeters &&
        unit.y + unit.height / 2 >= 0 &&
        unit.y + unit.height / 2 <= floorHeightMeters,
    );
  return { floorSize, units };
}

export function previewViewport(model, highlightedUnitId, width, height) {
  const { floorSize, units } = model;
  const unit = units.find((candidate) => candidate.id === highlightedUnitId);
  if (!unit) return null;
  const fit = Math.min(width / floorSize.width, height / floorSize.height);
  const unitExtent = Math.max(unit.width, unit.height) * CANVAS_CONFIG.PIXELS_PER_METER;
  const scale = Math.max(fit, Math.min(fit * 3, 32 / unitExtent));
  const centerX = (unit.x + unit.width / 2) * CANVAS_CONFIG.PIXELS_PER_METER;
  const centerY = (unit.y + unit.height / 2) * CANVAS_CONFIG.PIXELS_PER_METER;
  const scaledWidth = floorSize.width * scale;
  const scaledHeight = floorSize.height * scale;
  const x =
    scaledWidth <= width
      ? (width - scaledWidth) / 2
      : Math.max(width - scaledWidth, Math.min(0, width / 2 - centerX * scale));
  const y =
    scaledHeight <= height
      ? (height - scaledHeight) / 2
      : Math.max(height - scaledHeight, Math.min(0, height / 2 - centerY * scale));
  return { unit, scale, x, y, centerX, centerY };
}

/** A non-interactive view of the same floor and storage-unit layers as the full map. */
export function FloorMapPreview({ model, highlightedUnitId, locationName }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const height = width
    ? Math.max(170, Math.min(240, (width * model.floorSize.height) / model.floorSize.width))
    : 200;
  const viewport = useMemo(
    () => (width ? previewViewport(model, highlightedUnitId, width, height) : null),
    [model, highlightedUnitId, width, height],
  );

  return (
    <div
      ref={containerRef}
      className="location-map-preview"
      style={{ height }}
      role="img"
      aria-label={`${locationName} highlighted in ${model.floorSize.width / CANVAS_CONFIG.PIXELS_PER_METER} by ${model.floorSize.height / CANVAS_CONFIG.PIXELS_PER_METER} metre floor map`}
      data-highlighted-unit={highlightedUnitId}
    >
      {viewport && (
        <Stage
          width={width}
          height={height}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          x={viewport.x}
          y={viewport.y}
          listening={false}
        >
          <GridLayer
            width={model.floorSize.width}
            height={model.floorSize.height}
            showGrid={false}
          />
          <UnitLayer
            units={model.units}
            selectedIds={new Set()}
            isCanvasEditMode={false}
            getGroupRef={() => ({ current: null })}
            onUnitClick={() => {}}
            onDragMove={() => {}}
            onDragEnd={() => {}}
            onTransformEnd={() => {}}
            interactive={false}
          />
          <HighlightLayer units={model.units} highlightedUnitId={highlightedUnitId} />
          <Layer listening={false}>
            <Circle
              x={viewport.centerX}
              y={viewport.centerY}
              radius={8 / viewport.scale}
              fill={COLOURS.ACCENT}
              stroke={COLOURS.CARD_BG}
              strokeWidth={2 / viewport.scale}
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
}
