import { CANVAS_CONFIG } from "../CanvasConfig";

export function fitViewport(displaySize, floorSize) {
  const scale = Math.min(
    CANVAS_CONFIG.MAX_SCALE,
    Math.max(
      CANVAS_CONFIG.MIN_SCALE,
      Math.min(displaySize.width / floorSize.width, displaySize.height / floorSize.height) * 0.9,
    ),
  );
  return {
    scale,
    stagePos: {
      x: (displaySize.width - floorSize.width * scale) / 2,
      y: (displaySize.height - floorSize.height * scale) / 2,
    },
  };
}

export function resizeViewport(state, displaySize, floorSize, reset = false) {
  if (reset || !state.displaySize.width || !state.displaySize.height) {
    return { ...state, displaySize, ...fitViewport(displaySize, floorSize) };
  }
  const center = {
    x: (state.displaySize.width / 2 - state.stagePos.x) / state.scale,
    y: (state.displaySize.height / 2 - state.stagePos.y) / state.scale,
  };
  return {
    ...state,
    displaySize,
    stagePos: {
      x: displaySize.width / 2 - center.x * state.scale,
      y: displaySize.height / 2 - center.y * state.scale,
    },
  };
}
