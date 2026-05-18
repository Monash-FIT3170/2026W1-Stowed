// Canvas UI state actions
export const CANVAS_ACTIONS = {
    // Selection
    SELECT_UNIT:      "SELECT_UNIT",
    DESELECT_ALL:     "DESELECT_ALL",
  
    // Ghost / drag-over preview
    SET_GHOST:        "SET_GHOST",
  
    // Multi-drag offsets
    SET_DRAG_OFFSETS: "SET_DRAG_OFFSETS",
    CLEAR_DRAG_OFFSETS: "CLEAR_DRAG_OFFSETS",
  
    // Viewport
    SET_SCALE:        "SET_SCALE",
    SET_STAGE_POS:    "SET_STAGE_POS",
    SET_DISPLAY_SIZE: "SET_DISPLAY_SIZE",

    // Copy/Paste
    COPY_UNITS: "COPY_UNITS",
  PASTE_UNITS: "PASTE_UNITS",

  // Delete units
  DELETE_UNIT: "DELETE_UNIT"
};