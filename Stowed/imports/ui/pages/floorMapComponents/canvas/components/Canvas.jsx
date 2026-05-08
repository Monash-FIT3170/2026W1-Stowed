import { useRef, useEffect, useReducer } from "react";
import { Stage } from "react-konva";

import { useEditor }         from "../editor/EditorContext";
import { canvasReducer, initialCanvasState } from "../editor/EditorReducer";
import { CANVAS_ACTIONS }    from "../editor/Actions";
import { useCanvasHandlers } from "../editor/hooks/UseCanvasHandlers";

import { GridLayer }         from "./layers/GridLayer";
import { UnitLayer }         from "./layers/UnitLayer";
import { TransformerLayer }  from "./layers/TransformerLayer";
import { GhostLayer }        from "./layers/GhostLayer";

export const CANVAS_CONFIG = {
  METERS_PER_CELL:  1,
  PIXELS_PER_METER: 50,
  GRID_SIZE:        50 * 1,
};

export function Canvas({ style }) {
  const { units, commitUnits, activeTool, floorSize, canvasSettings } = useEditor();

  const width  = floorSize.width;
  const height = floorSize.height;

  const gridInterval = canvasSettings?.gridInterval ?? CANVAS_CONFIG.METERS_PER_CELL;
  const showGrid     = canvasSettings?.showGrid     ?? true;
  const snapEnabled  = canvasSettings?.snapToGrid   ?? true;
  const gridSizePx   = gridInterval * CANVAS_CONFIG.PIXELS_PER_METER;

  // REFS 
  const stageRef     = useRef(null);
  const wrapperRef   = useRef(null);
  const containerRef = useRef(null);
  const groupRefs    = useRef({});

  // REDUCER 
  const [state, dispatch] = useReducer(canvasReducer, initialCanvasState);
  const { selectedIds, ghostUnit, dragOffsets, scale, stagePos, displaySize } = state;

  // MEASURE CONTAINER ON MOUNT 
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    dispatch({ type: CANVAS_ACTIONS.SET_DISPLAY_SIZE, payload: { width, height } });
  }, []);

  // HANDLERS 
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
    activeTool,
    wrapperRef,
  });

  // RENDER 
  return (
    <div
      ref={wrapperRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{ width: "100%", height: "100%" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
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
          <GridLayer
            width={width}
            height={height}
            gridSizePx={gridSizePx}
            showGrid={showGrid}
          />

          <UnitLayer
            units={units}
            selectedIds={selectedIds}
            activeTool={activeTool}
            getGroupRef={getGroupRef}
            onUnitClick={handleUnitClick}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
          />

          <TransformerLayer
            selectedIds={selectedIds}
            getGroupRef={getGroupRef}
          />

          <GhostLayer
            ghostUnit={ghostUnit}
            dragOffsets={dragOffsets}
            selectedIds={selectedIds}
            units={units}
            snapEnabled={snapEnabled}
            gridSizePx={gridSizePx}
          />
        </Stage>
      </div>
    </div>
  );
}