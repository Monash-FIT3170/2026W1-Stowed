import { CANVAS_ACTIONS } from "./Actions";

export const initialCanvasState = {
  selectedIds:  new Set(),
  ghostUnit:    null,
  dragOffsets:  { deltaX: 0, deltaY: 0, unitId: null },
  scale:        1,
  stagePos:     { x: 0, y: 0 },
  displaySize:  { width: 0, height: 0 },
  clipboard: [],
};

/**
 * Reducer for transient canvas UI state. Does not touch persistent unit data
 * that lives in EditorContext and is updated via commitUnits.
 *
 * @param {typeof initialCanvasState} state
 * @param {{ type: string, payload?: any }} action
 * 
 * @returns {typeof initialCanvasState}
 *
 * @example
 * // SELECT_UNIT         - sets selection to [id], or toggles id when shiftKey is true.
 * // DESELECT_ALL        - clears the selection set.
 * // SET_GHOST           - stores a ghost unit descriptor during a palette drag-over.
 * // SET_DRAG_OFFSETS    - records live deltaX/deltaY during a multi-unit drag.
 * // CLEAR_DRAG_OFFSETS  - resets drag offsets on drag end.
 * // SET_SCALE           - updates the stage zoom level.
 * // SET_STAGE_POS       - persists the stage pan position after a stage drag ends.
 * // SET_DISPLAY_SIZE    - stores the measured pixel size of the canvas container.
 */
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

    case CANVAS_ACTIONS.COPY_UNITS:
      return { ...state, clipboard: action.payload.units };
    
    case CANVAS_ACTIONS.PASTE_UNITS:
      return { ...state, selectedIds: new Set(action.payload.ids) };

    case CANVAS_ACTIONS.DELETE_UNIT:
      return { ...state, selectedIds: new Set() }

    default:
      return state;
  }
}