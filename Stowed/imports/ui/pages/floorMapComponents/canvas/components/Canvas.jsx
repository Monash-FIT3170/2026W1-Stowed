import { useRef, useEffect, useReducer } from "react";
import { Stage } from "react-konva";
import Konva from "konva";

import { useEditor } from "../editor/EditorContext";
import { canvasReducer, initialCanvasState } from "../editor/EditorReducer";
import { CANVAS_ACTIONS } from "../editor/Actions";
import { useCanvasHandlers } from "../hooks/UseCanvasHandlers";
import { CANVAS_CONFIG } from "../CanvasConfig";

import { GridLayer } from "./layers/GridLayer";
import { UnitLayer } from "./layers/UnitLayer";
import { TransformerLayer } from "./layers/TransformerLayer";
import { GhostLayer } from "./layers/GhostLayer";
import { LowStockLayer } from "./layers/LowStockLayer";

if (typeof window !== "undefined") {
  Konva.pixelRatio = Math.max(window.devicePixelRatio || 1, 3);
}

export function Canvas({ style, isCanvasEditMode, setSelectedStorageUnitId, setTooltip }) {
  const { units, commitUnits, floorSize, canvasSettings } = useEditor();

  const width = floorSize.width;
  const height = floorSize.height;

  const gridInterval = canvasSettings?.gridInterval ?? CANVAS_CONFIG.METERS_PER_CELL;
  const showGrid = isCanvasEditMode ? (canvasSettings?.showGrid ?? true) : false;
  const snapEnabled = canvasSettings?.snapToGrid ?? true;
  const gridSizePx = gridInterval * CANVAS_CONFIG.PIXELS_PER_METER;

  const stageRef = useRef(null);
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const groupRefs = useRef({});

  const [state, dispatch] = useReducer(canvasReducer, initialCanvasState);
  const { selectedIds, ghostUnit, dragOffsets, scale, stagePos, displaySize, clipboard } = state;

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
    gridSizePx,
    gridInterval,
    width,
    height,
    wrapperRef,
    clipboard,
    isCanvasEditMode,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function measure() {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return; // guard - never dispatch zero dimensions
      dispatch({
        type: CANVAS_ACTIONS.SET_DISPLAY_SIZE,
        payload: { width, height },
      });
      const centeredX = (width - floorSize.width * scale) / 2;
      const centeredY = (height - floorSize.height * scale) / 2;
      dispatch({
        type: CANVAS_ACTIONS.SET_STAGE_POS,
        payload: { x: centeredX, y: centeredY },
      });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [floorSize.width, floorSize.height, scale]);

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

  return (
    <div
      ref={wrapperRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
        {/* Only mount Stage once we have real pixel dimensions */}
        {displaySize.width > 0 && displaySize.height > 0 && (
          <Stage
            ref={stageRef}
            width={displaySize.width}
            height={displaySize.height}
            scaleX={scale}
            scaleY={scale}
            onWheel={handleWheel}
            style={style}
            draggable
            x={stagePos.x}
            y={stagePos.y}
            onDragEnd={handleDragEndGrid}
            onClick={handleStageClick}
          >
            <GridLayer width={width} height={height} gridSizePx={gridSizePx} showGrid={showGrid} />

            <UnitLayer
              units={units}
              selectedIds={selectedIds}
              isCanvasEditMode={isCanvasEditMode}
              getGroupRef={getGroupRef}
              onUnitClick={(unit, e) => {
                setSelectedStorageUnitId?.(unit._id || unit.id);
                handleUnitClick(unit, e);
              }}
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
              gridSizePx={gridSizePx}
            />

            <LowStockLayer
              units={units}
              isCanvasEditMode={isCanvasEditMode}
              onHover={(data) => setTooltip?.(data)}
              onHoverEnd={() => setTooltip?.(null)}
              onUnitClick={(unitId) => setSelectedStorageUnitId?.(unitId)}
            />
          </Stage>
        )}
      </div>

      {/* ZOOM CONTROLS - floating over the bottom-right of the canvas */}
      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "var(--card-bg)",
          border: "1px solid var(--border-light)",
          borderRadius: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          padding: 4,
          zIndex: 50,
        }}
      >
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          style={zoomButtonStyle}
        >
          −
        </button>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            minWidth: 38,
            textAlign: "center",
            userSelect: "none",
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          style={zoomButtonStyle}
        >
          +
        </button>
        <div style={{ width: 1, height: 20, background: "var(--border-light)", margin: "0 2px" }} />
        <button
          type="button"
          onClick={handleFitToScreen}
          aria-label="Fit to screen"
          title="Fit to screen"
          style={{ ...zoomButtonStyle, width: "auto", padding: "0 10px", fontSize: 11 }}
        >
          Fit
        </button>
      </div>
    </div>
  );
}

const zoomButtonStyle = {
  width: 26,
  height: 26,
  border: "none",
  background: "transparent",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  color: "var(--text-dark)",
  fontFamily: "inherit",
};
