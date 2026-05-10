import { createContext, useContext, useRef, useState } from "react";
import { CANVAS_CONFIG } from "../CanvasConfig";

// --- TOOL OPTIONS ---
export const TOOLS = {
  SELECT: "select",
  MOVE:   "move",
  ADD:    "add",
  DELETE: "delete",
};

// --- DEFAULT CANVAS SETTINGS ---
export const DEFAULT_CANVAS_SETTINGS = {
  gridInterval: CANVAS_CONFIG.METERS_PER_CELL,
  showGrid:     true,
  snapToGrid:   true,
};

const EditorContext = createContext(null);

/**
 * Top level context provider for the floor plan editor.
 * Owns all shared editor state: active tool, floor dimensions, canvas settings,
 * placed units, undo/redo history, and save/load.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function EditorProvider({ children }) {
  const [activeTool, setActiveTool]                   = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize]                     = useState({ width: 500, height: 500 });
  const [canvasSettings, setCanvasSettings]           = useState(DEFAULT_CANVAS_SETTINGS);
  const [isCanvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [isCanvasEditMode, setCanvasEditMode] = useState(false);
  const [units, setUnits]                             = useState([]);
  const [pendingUnit, setPendingUnit]                 = useState(null);

  // --- UNDO / REDO HISTORY ---
  const [_, forceRender]  = useState(0);
  const historyRef        = useRef({ stack: [[]], index: 0 });
  const canUndo           = historyRef.current.index > 0;
  const canRedo           = historyRef.current.index < historyRef.current.stack.length - 1;

  function commitUnits(updater) {
    const next = typeof updater === "function" ? updater(units) : updater;
    const { stack, index } = historyRef.current;
    const trimmed = stack.slice(0, index + 1);
    historyRef.current = { stack: [...trimmed, next], index: index + 1 };
    setUnits(next);
  }

  function handleUndo() {
    const { stack, index } = historyRef.current;
    if (index === 0) return;
    const newIndex = index - 1;
    historyRef.current = { stack, index: newIndex };
    setUnits(stack[newIndex]);
    forceRender((n) => n + 1);
  }

  function handleRedo() {
    const { stack, index } = historyRef.current;
    if (index >= stack.length - 1) return;
    const newIndex = index + 1;
    historyRef.current = { stack, index: newIndex };
    setUnits(stack[newIndex]);
    forceRender((n) => n + 1);
  }

  // --- SAVE / LOAD ---
  function handleSaveLayout() {
    localStorage.setItem("floorMapLayout", JSON.stringify({ floorSize, units }));
    alert("Layout saved successfully!");
  }

  function handleLoadLayout() {
    const saved = localStorage.getItem("floorMapLayout");
    if (!saved) { alert("No saved layout found."); return; }
    const layout = JSON.parse(saved);
    setFloorSize(layout.floorSize);
    commitUnits(layout.units);
    alert("Layout loaded successfully!");
  }

  // --- PLACEMENT ---
  function handlePlaceUnit(template) {
    setPendingUnit(template);
    setActiveTool(TOOLS.ADD);
  }

  function handleUnitPlaced() {
    setPendingUnit(null);
    setActiveTool(TOOLS.SELECT);
  }

  // --- CANVAS SETTINGS ---
  function handleCanvasSettingsSave({ floorSize: newFloorSize, gridInterval, showGrid, snapToGrid }) {
    setFloorSize(newFloorSize);
    setCanvasSettings({ gridInterval, showGrid, snapToGrid });
  }

  const value = {
    // Tool
    activeTool, setActiveTool,

    // Floor
    floorSize, setFloorSize,

    // Canvas settings
    canvasSettings, isCanvasSettingsOpen, setCanvasSettingsOpen, handleCanvasSettingsSave,

    //Mode Toggling
    isCanvasEditMode, setCanvasEditMode,


    // Units
    units, commitUnits,
    pendingUnit, setPendingUnit,

    // History
    canUndo, canRedo, handleUndo, handleRedo,

    // Save / load
    handleSaveLayout, handleLoadLayout,

    // Placement helpers
    handlePlaceUnit, handleUnitPlaced,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

/**
 * Consume editor context. Must be used inside an EditorProvider.
 * @returns {ReturnType<typeof EditorContext>}
 */
export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an EditorProvider");
  return ctx;
}