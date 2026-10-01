import { useRef, useEffect, useReducer, forwardRef, useImperativeHandle } from "react";
import { Stage } from "react-konva";
import Konva from "konva";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";

import { useEditor } from "../editor/EditorContext";
import { canvasReducer, initialCanvasState } from "../editor/EditorReducer";
import { CANVAS_ACTIONS } from "../editor/Actions";
import { useCanvasHandlers } from "../hooks/UseCanvasHandlers";
import { CANVAS_CONFIG } from "../CanvasConfig";
import {
  StorageLocations,
  StorageUnits,
  FloorMaps,
  Sites,
} from "/imports/api/locations/collections";

import { GridLayer } from "./layers/GridLayer";
import { UnitLayer } from "./layers/UnitLayer";
import { TransformerLayer } from "./layers/TransformerLayer";
import { GhostLayer } from "./layers/GhostLayer";
import { LowStockLayer } from "./layers/LowStockLayer";
import { StocktakeAlertLayer } from "./layers/StocktakeAlertLayer";
import { FloorMapIcon } from "../../FloorMapIcon";

if (typeof window !== "undefined") Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

export const Canvas = forwardRef(function Canvas(
  {
    style,
    isCanvasEditMode,
    selectedStorageUnitId,
    setSelectedStorageUnitId,
    setTooltip,
    publicView = false,
  },
  ref,
) {
  const { units, commitUnits, floorSize, canvasSettings } = useEditor();

  const { storageLocations, storageUnits, floorMaps, sites } = useTracker(() => {
    if (publicView) return { storageLocations: [], storageUnits: [], floorMaps: [], sites: [] };
    Meteor.subscribe("locations.all");

    return {
      storageLocations: StorageLocations.find().fetch(),
      storageUnits: StorageUnits.find().fetch(),
      floorMaps: FloorMaps.find().fetch(),
      sites: Sites.find().fetch(),
    };
  }, [publicView]);

  const width = floorSize.width;
  const height = floorSize.height;

  const gridInterval = canvasSettings?.gridInterval ?? CANVAS_CONFIG.METERS_PER_CELL;
  const snapInterval = canvasSettings?.snapInterval ?? CANVAS_CONFIG.DEFAULT_SNAP_INTERVAL;
  const showGrid = isCanvasEditMode ? (canvasSettings?.showGrid ?? true) : false;
  const snapEnabled = canvasSettings?.snapToGrid ?? true;
  const gridSizePx = gridInterval * CANVAS_CONFIG.PIXELS_PER_METER;
  const snapSizePx = snapInterval * CANVAS_CONFIG.PIXELS_PER_METER;

  const stageRef = useRef(null);
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const groupRefs = useRef({});
  const pinchDistanceRef = useRef(null);
  const measuredFloorSizeRef = useRef(null);

  const [state, dispatch] = useReducer(canvasReducer, initialCanvasState);
  const { selectedIds, ghostUnit, dragOffsets, scale, stagePos, displaySize, clipboard } = state;
  const visibleSelectedIds = isCanvasEditMode
    ? selectedStorageUnitId && !selectedIds.has(selectedStorageUnitId)
      ? new Set([selectedStorageUnitId])
      : selectedIds
    : new Set(selectedStorageUnitId ? [selectedStorageUnitId] : []);

  const {
    getGroupRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleUnitClick,
    handleStageClick,
    handleDragMove,
    handleDragEnd,
    handleDragEndGrid,
    handleTransformEnd,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleDelete,
  } = useCanvasHandlers({
    dispatch,
    units,
    setUnits: commitUnits,
    selectedIds,
    stageRef,
    groupRefs,
    snapEnabled,
    snapSizePx,
    snapInterval,
    width,
    height,
    wrapperRef,
    clipboard,
    isCanvasEditMode,
  });

  useEffect(() => {
    if (!isCanvasEditMode) {
      dispatch({ type: CANVAS_ACTIONS.DESELECT_ALL });
    }
  }, [isCanvasEditMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function measure() {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const reset =
        measuredFloorSizeRef.current?.width !== floorSize.width ||
        measuredFloorSizeRef.current?.height !== floorSize.height;
      measuredFloorSizeRef.current = floorSize;
      dispatch({
        type: CANVAS_ACTIONS.RESIZE_VIEWPORT,
        payload: { displaySize: { width, height }, floorSize, reset },
      });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [floorSize]);

  function handleTouchMove(event) {
    const touches = event.evt.touches;
    const stage = stageRef.current;
    if (!stage || touches.length !== 2) return;
    event.evt.preventDefault();
    stage.stopDrag();
    event.target.stopDrag();
    stage.draggable(false);
    const box = stage.container().getBoundingClientRect();
    const center = {
      x: (touches[0].clientX + touches[1].clientX) / 2 - box.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - box.top,
    };
    const distance = Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
    if (pinchDistanceRef.current) {
      const oldScale = stage.scaleX();
      const nextScale = Math.min(
        CANVAS_CONFIG.MAX_SCALE,
        Math.max(CANVAS_CONFIG.MIN_SCALE, (oldScale * distance) / pinchDistanceRef.current),
      );
      const world = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale };
      const nextPosition = {
        x: center.x - world.x * nextScale,
        y: center.y - world.y * nextScale,
      };
      stage.scale({ x: nextScale, y: nextScale });
      stage.position(nextPosition);
      dispatch({ type: CANVAS_ACTIONS.SET_SCALE, payload: { scale: nextScale } });
      dispatch({
        type: CANVAS_ACTIONS.SET_STAGE_POS,
        payload: nextPosition,
      });
    }
    pinchDistanceRef.current = distance;
  }

  function handleTouchEnd() {
    pinchDistanceRef.current = null;
    stageRef.current?.draggable(true);
  }

  function handleStageActivate(event) {
    handleStageClick(event);
    if (isCanvasEditMode && event.target === event.target.getStage()) {
      setSelectedStorageUnitId?.(null);
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      const target = e.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isTyping) return;

      if (e.key === "c" && (e.ctrlKey || e.metaKey)) handleCopy();
      if (e.key === "v" && (e.ctrlKey || e.metaKey)) handlePaste();
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); // otherwise the browser bookmarks the page
        handleDuplicate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCopy, handlePaste, handleDuplicate, handleDelete]);

  useImperativeHandle(ref, () => ({
    exportPng() {
      const stage = stageRef.current;
      if (!stage) return;
      stage.batchDraw();
      requestAnimationFrame(() => {
        const dataUrl = stage.toDataURL({ pixelRatio: 2 });
        const link = document.createElement("a");
        link.download = "floor-map.png";
        link.href = dataUrl;
        link.click();
      });
    },
  }));

  return (
    <div
      ref={wrapperRef}
      className="floor-map-canvas"
      onDrop={isCanvasEditMode ? handleDrop : undefined}
      onDragOver={isCanvasEditMode ? handleDragOver : undefined}
      onDragLeave={isCanvasEditMode ? handleDragLeave : undefined}
      aria-label={
        publicView
          ? "Public floor map. Drag to move around; pinch or use the controls to zoom."
          : "Floor map canvas. Drag to move around; use the controls to zoom."
      }
    >
      <div ref={containerRef} className="floor-map-canvas-stage">
        {/* Only mount Stage once we have real pixel dimensions */}
        {displaySize.width > 0 && displaySize.height > 0 && (
          <Stage
            ref={stageRef}
            width={displaySize.width}
            height={displaySize.height}
            scaleX={scale}
            scaleY={scale}
            onWheel={handleWheel}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={style}
            draggable
            x={stagePos.x}
            y={stagePos.y}
            onDragEnd={handleDragEndGrid}
            onClick={handleStageActivate}
            onTap={handleStageActivate}
          >
            <GridLayer width={width} height={height} gridSizePx={gridSizePx} showGrid={showGrid} />

            <UnitLayer
              units={units}
              selectedIds={visibleSelectedIds}
              isCanvasEditMode={isCanvasEditMode}
              getGroupRef={getGroupRef}
              onUnitClick={
                publicView
                  ? () => {}
                  : (unit, e) => {
                      const unitId = unit._id || unit.id;
                      const isOnlySelectedUnit =
                        isCanvasEditMode && selectedIds.size === 1 && selectedIds.has(unitId);
                      setSelectedStorageUnitId?.(isOnlySelectedUnit ? null : unitId);
                      handleUnitClick(unit, e);
                    }
              }
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />

            <TransformerLayer selectedIds={selectedIds} getGroupRef={getGroupRef} />

            <GhostLayer
              ghostUnit={ghostUnit}
              dragOffsets={dragOffsets}
              selectedIds={selectedIds}
              units={units}
              snapEnabled={snapEnabled}
              snapSizePx={snapSizePx}
            />

            {!publicView && (
              <LowStockLayer
                units={units}
                isCanvasEditMode={isCanvasEditMode}
                onHover={(data) => setTooltip?.(data)}
                onHoverEnd={() => setTooltip?.(null)}
                onUnitClick={(unitId) => setSelectedStorageUnitId?.(unitId)}
                selectedStorageUnitId={selectedStorageUnitId}
              />
            )}

            {!publicView && (
              <StocktakeAlertLayer
                units={units}
                storageLocations={storageLocations}
                storageUnits={storageUnits}
                floorMaps={floorMaps}
                sites={sites}
                isCanvasEditMode={isCanvasEditMode}
                onUnitClick={(unitId) => setSelectedStorageUnitId?.(unitId)}
              />
            )}
          </Stage>
        )}
      </div>

      {/* ZOOM CONTROLS - floating over the bottom-right of the canvas */}
      <div className="floor-map-zoom" role="group" aria-label="Map zoom controls">
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          className="floor-map-zoom-button"
        >
          <FloorMapIcon name="minus" />
        </button>
        <span className="floor-map-zoom-value" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          className="floor-map-zoom-button"
        >
          <FloorMapIcon name="plus" />
        </button>
        <span className="floor-map-zoom-divider" aria-hidden="true" />
        <button
          type="button"
          onClick={handleFitToScreen}
          aria-label="Fit to screen"
          title="Fit to screen"
          className="floor-map-zoom-button floor-map-zoom-fit"
        >
          <FloorMapIcon name="fit" />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
});
