import { CANVAS_ACTIONS } from "./Actions";

export const initialCanvasState = {
  selectedIds:  new Set(),
  ghostUnit:    null,
  dragOffsets:  { deltaX: 0, deltaY: 0, unitId: null },
  scale:        1,
  stagePos:     { x: 0, y: 0 },
  displaySize:  { width: 0, height: 0 },
};

export function canvasReducer(state, action) {
  switch (action.type) {

    case CANVAS_ACTIONS.SELECT_UNIT: {
      const { id, shiftKey } = action.payload;
      if (!shiftKey) return { ...state, selectedIds: new Set([id]) };
      const next = new Set(state.selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...state, selectedIds: next };
    }

    case CANVAS_ACTIONS.DESELECT_ALL:
      return { ...state, selectedIds: new Set() };

    case CANVAS_ACTIONS.SET_GHOST:
      return { ...state, ghostUnit: action.payload.ghost };

    case CANVAS_ACTIONS.SET_DRAG_OFFSETS:
      return { ...state, dragOffsets: action.payload };

    case CANVAS_ACTIONS.CLEAR_DRAG_OFFSETS:
      return { ...state, dragOffsets: { deltaX: 0, deltaY: 0, unitId: null } };

    case CANVAS_ACTIONS.SET_SCALE:
      return { ...state, scale: action.payload.scale };

    case CANVAS_ACTIONS.SET_STAGE_POS:
      return { ...state, stagePos: action.payload };

    case CANVAS_ACTIONS.SET_DISPLAY_SIZE:
      return { ...state, displaySize: action.payload };

    default:
      return state;
  }
}