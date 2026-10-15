import { useRef, useEffect, useReducer, forwardRef, useImperativeHandle } from "react";
import { Stage, Layer, Rect, Circle, Group, Text, Line } from "react-konva";
import Konva from "konva";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";

import { CANVAS_MODES, useEditor } from "../editor/EditorContext";
import { canvasReducer, initialCanvasState } from "../editor/EditorReducer";
import { CANVAS_ACTIONS } from "../editor/Actions";
import { useCanvasHandlers } from "../hooks/UseCanvasHandlers";
import { useRouteHandlers } from "../hooks/UseRouteHandlers";
import { CANVAS_CONFIG } from "../CanvasConfig";
import { COLOURS } from "../../FloorMapStyles";
import { getStartingPoint } from "../routePoint";
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
import { RouteLayer } from "./layers/RouteLayer";
import { HighlightLayer } from "./layers/HighlightLayer";
import { FloorMapIcon } from "../../FloorMapIcon";

if (typeof window !== "undefined") Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

export const Canvas = forwardRef(function Canvas(
  {
    style,
    selectedStorageUnitId,
    setSelectedStorageUnitId,
    setTooltip,
    publicView = false,
    highlightedUnitId,
    startingPoint = null,
    plannedRoute = null,
    isSelectingStart = false,
    onStartingPointSelect,
    fitInsetRight = 0,
    focusRequest = null,
  },
  ref,
) {
  const {
    units,
    commitUnits,
    floorSize,
    canvasSettings,
    canvasMode,
    isCanvasEditMode,
    walkwayNodes,
    walkwayLinks,
  } = useEditor();

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
  const isPickingStart = isSelectingStart && canvasMode === CANVAS_MODES.VIEW;

  const gridInterval = canvasSettings?.gridInterval ?? CANVAS_CONFIG.METERS_PER_CELL;
  const snapInterval = canvasSettings?.snapInterval ?? CANVAS_CONFIG.DEFAULT_SNAP_INTERVAL;
  const showGrid = canvasMode !== CANVAS_MODES.VIEW ? (canvasSettings?.showGrid ?? true) : false;
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
    fitInsetRight,
  });

  const {
    handlesClicks: routeHandlesClicks,
    cursor: routeCursor,
    previewNode,
    pendingLinkNodeId,
    selectedNodeId,
    unavailableNodeIds,
    linkPreviewEnd,
    junctionPreview,
    deleteTarget,
    handleRouteMouseMove,
    handleRouteMouseLeave,
    handleRouteClick,
  } = useRouteHandlers({ stageRef, snapEnabled, snapSizePx, width, height });

  useEffect(() => {
    if (!isCanvasEditMode) {
      dispatch({ type: CANVAS_ACTIONS.DESELECT_ALL });
    }
  }, [isCanvasEditMode]);

  // Fit the map to the screen whenever the user switches mode
  const prevCanvasModeRef = useRef(canvasMode);
  useEffect(() => {
    if (prevCanvasModeRef.current === canvasMode) return;
    prevCanvasModeRef.current = canvasMode;
    handleFitToScreen();
  }, [canvasMode, handleFitToScreen]);

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
    // Panning stays off while a starting point is being picked
    stageRef.current?.draggable(!isPickingStart);
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

  /** A unit's centre in stage pixels at scale 1, or null if it isn't loaded. */
  function unitCentre(unitId) {
    const unit = units.find((candidate) => (candidate._id || candidate.id) === unitId);
    if (!unit) return null;
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    return { x: (unit.x + unit.width / 2) * px, y: (unit.y + unit.height / 2) * px };
  }

  // A focus request can arrive before this map's units have loaded (the page
  // has just switched maps), so it waits for the unit and runs once per nonce.
  const handledFocusNonceRef = useRef(null);
  useEffect(() => {
    if (!focusRequest || handledFocusNonceRef.current === focusRequest.nonce) return;
    const centre = unitCentre(focusRequest.unitId);
    if (!centre) return;
    handledFocusNonceRef.current = focusRequest.nonce;
    dispatch({ type: CANVAS_ACTIONS.CENTRE_ON, payload: centre });
  });

  useImperativeHandle(ref, () => ({
    /**
     * Pans the stage so `unitId` sits in the middle of the viewport, leaving
     * the zoom level alone - changing scale here would be undone by the
     * re-centring effect above, which fires whenever scale changes.
     */
    focusUnit(unitId) {
      const centre = unitCentre(unitId);
      if (centre) dispatch({ type: CANVAS_ACTIONS.CENTRE_ON, payload: centre });
    },
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

  const handleMapClick = (event) => {
    if (!isPickingStart) {
      handleStageActivate(event);
      return;
    }
    const point = getStartingPoint(stageRef.current, width, height);
    if (point) onStartingPointSelect?.(point);
  };

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
            style={
              routeCursor
                ? { ...style, cursor: routeCursor }
                : { ...style, cursor: isPickingStart ? "crosshair" : style?.cursor }
            }
            draggable={!isPickingStart}
            x={stagePos.x}
            y={stagePos.y}
            onDragEnd={handleDragEndGrid}
            onClick={routeHandlesClicks ? handleRouteClick : handleMapClick}
            onMouseMove={handleRouteMouseMove}
            onMouseLeave={handleRouteMouseLeave}
            onTap={handleMapClick}
          >
            <GridLayer width={width} height={height} gridSizePx={gridSizePx} showGrid={showGrid} />

            <UnitLayer
              units={units}
              selectedIds={visibleSelectedIds}
              isCanvasEditMode={isCanvasEditMode}
              getGroupRef={getGroupRef}
              onUnitClick={
                publicView
                  ? (unit) => setSelectedStorageUnitId?.(unit._id || unit.id)
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
              opacity={
                canvasMode === CANVAS_MODES.ROUTE ? CANVAS_CONFIG.ROUTE_MODE_UNIT_OPACITY : 1
              }
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

            {canvasMode === CANVAS_MODES.VIEW && (
              <>
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

                {!isCanvasEditMode && (
                  <Layer>
                    {/* Intercept shelf/alert clicks only while choosing a start. */}
                    {isPickingStart && (
                      <Rect x={0} y={0} width={width} height={height} fill="transparent" />
                    )}
                    {/* Planned route: the path to walk, with numbered pick stops */}
                    {plannedRoute && (
                      <Group listening={false}>
                        <Line
                          points={plannedRoute.path.flatMap((p) => [
                            p.x * CANVAS_CONFIG.PIXELS_PER_METER,
                            p.y * CANVAS_CONFIG.PIXELS_PER_METER,
                          ])}
                          stroke={COLOURS.ACCENT}
                          strokeWidth={4}
                          strokeScaleEnabled={false}
                          lineCap="round"
                          lineJoin="round"
                          dash={[10, 6]}
                        />
                        {plannedRoute.stops.map((stop, index) => (
                          <Group
                            key={stop.nodeId}
                            x={stop.x * CANVAS_CONFIG.PIXELS_PER_METER}
                            y={stop.y * CANVAS_CONFIG.PIXELS_PER_METER}
                            scaleX={1 / scale}
                            scaleY={1 / scale}
                          >
                            <Circle
                              radius={11}
                              fill="white"
                              stroke={COLOURS.ACCENT}
                              strokeWidth={3}
                            />
                            <Text
                              x={-11}
                              y={-6}
                              width={22}
                              text={String(index + 1)}
                              align="center"
                              fontSize={12}
                              fontStyle="bold"
                              fill={COLOURS.ACCENT}
                            />
                          </Group>
                        ))}
                      </Group>
                    )}
                    {startingPoint && (
                      <Group
                        x={startingPoint.x * CANVAS_CONFIG.PIXELS_PER_METER}
                        y={startingPoint.y * CANVAS_CONFIG.PIXELS_PER_METER}
                        scaleX={1 / scale}
                        scaleY={1 / scale}
                        listening={false}
                      >
                        <Circle radius={12} fill="#b5532a" stroke="white" strokeWidth={3} />
                        <Circle radius={3} fill="white" />
                        <Rect
                          x={-23}
                          y={17}
                          width={46}
                          height={23}
                          fill="#b5532a"
                          cornerRadius={5}
                        />
                        <Text
                          x={-23}
                          y={22}
                          width={46}
                          text="Start"
                          align="center"
                          fontSize={12}
                          fontStyle="bold"
                          fill="white"
                        />
                      </Group>
                    )}
                  </Layer>
                )}
              </>
            )}

            {canvasMode === CANVAS_MODES.ROUTE && (
              <RouteLayer
                nodes={walkwayNodes}
                links={walkwayLinks}
                previewNode={previewNode}
                pendingLinkNodeId={pendingLinkNodeId}
                selectedNodeId={selectedNodeId}
                unavailableNodeIds={unavailableNodeIds}
                linkPreviewEnd={linkPreviewEnd}
                junctionPreview={junctionPreview}
                deleteTarget={deleteTarget}
                scale={scale}
              />
            )}

            <HighlightLayer units={units} highlightedUnitId={highlightedUnitId} />
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
