import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { FloorMaps, StorageUnits } from "/imports/api/locations/collections";
import { CANVAS_CONFIG } from "../CanvasConfig";

// --- TOOL OPTIONS ---
export const TOOLS = {
  SELECT: "select",
  MOVE: "move",
  ADD: "add",
};

// --- DEFAULT CANVAS SETTINGS ---
export const DEFAULT_CANVAS_SETTINGS = {
  gridInterval: CANVAS_CONFIG.METERS_PER_CELL,
  showGrid: true,
  snapToGrid: true,
};

const EditorContext = createContext(null);

/**
 * Top level context provider for the floor plan editor.
 * Owns all shared editor state: active tool, floor dimensions, canvas settings,
 * placed units, undo/redo history, and save/load.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function EditorProvider({ children, floorMapId }) {
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize] = useState({ width: 500, height: 500 });
  const [canvasSettings, setCanvasSettings] = useState(DEFAULT_CANVAS_SETTINGS);
  const [isCanvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [isCanvasEditMode, setCanvasEditMode] = useState(false);
  const [units, setUnits] = useState([]);
  const [pendingUnit, setPendingUnit] = useState(null);

  // --- UNDO / REDO HISTORY ---
  const [_, forceRender] = useState(0);
  const historyRef = useRef({ stack: [[]], index: 0 });
  const canUndo = historyRef.current.index > 0;
  const canRedo = historyRef.current.index < historyRef.current.stack.length - 1;

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

  const { isLoading, floorMap, savedUnits } = useTracker(() => {
    const handle = Meteor.subscribe("locations.all");

    const activeFloorMap = floorMapId
      ? FloorMaps.findOne(floorMapId)
      : FloorMaps.findOne();

    const activeFloorMapId = activeFloorMap?._id;

    return {
      isLoading: !handle.ready(),
      floorMap: activeFloorMap,
      savedUnits: activeFloorMapId
        ? StorageUnits.find({ floorMapId: activeFloorMapId }).fetch()
        : [],
    };
  }, [floorMapId]);

  useEffect(() => {
    if (isLoading || !floorMap) return;

    if (floorMap.floorSize) {
      setFloorSize(floorMap.floorSize);
    }

    if (floorMap.settings) {
      setCanvasSettings({
        ...DEFAULT_CANVAS_SETTINGS,
        ...floorMap.settings,
      });
    }

    const canvasUnits = savedUnits.map((unit) => ({
      id: unit._id,
      _id: unit._id,
      name: unit.name,
      type: unit.type,
      x: unit.position.x,
      y: unit.position.y,
      width: unit.position.width,
      height: unit.position.height,
      fill: unit.fill || "lightblue",
    }));

    setUnits(canvasUnits);
    historyRef.current = { stack: [canvasUnits], index: 0 };
  }, [isLoading, floorMap, savedUnits.length]);
  // --- SAVE / LOAD ---
  function callMethod(methodName, params) {
    return new Promise((resolve, reject) => {
      Meteor.call(methodName, params, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  async function handleSaveLayout() {
    if (!floorMap) {
      alert("No floor map exists in database.");
      return;
    }

    const activeFloorMapId = floorMap._id;

    try {
      await callMethod("floorMaps.update", {
        floorMapId: activeFloorMapId,
        siteId: floorMap.siteId,
        name: floorMap.name,
        imageUrl: floorMap.imageUrl || "",
        floorSize,
        settings: canvasSettings,
      });

      for (const unit of units) {
        const position = {
          x: unit.x,
          y: unit.y,
          width: unit.width,
          height: unit.height,
        };

        const currentUnitIds = units
          .filter((unit) => unit._id)
          .map((unit) => unit._id);

        for (const savedUnit of savedUnits) {
          if (!currentUnitIds.includes(savedUnit._id)) {
            await callMethod("storageUnits.delete", {
              storageUnitId: savedUnit._id,
            });
          }
        }

        if (unit._id) {
          await callMethod("storageUnits.update", {
            storageUnitId: unit._id,
            floorMapId: activeFloorMapId,
            name: unit.name,
            type: unit.type || "other",
            position,
          });
        } else {
          const newId = await callMethod("storageUnits.create", {
            floorMapId: activeFloorMapId,
            name: unit.name,
            type: unit.type || "other",
            position,
          });

          unit._id = newId;
          unit.id = newId;
        }
      }

      alert("Layout saved to database!");
    } catch (error) {
      console.error(error);
      alert(error.reason || "Failed to save layout.");
    }
  }

  function handleLoadLayout() {
    if (!floorMap) {
      alert("No floor map found.");
      return;
    }

    if (floorMap.floorSize) {
      setFloorSize(floorMap.floorSize);
    }

    if (floorMap.settings) {
      setCanvasSettings({
        ...DEFAULT_CANVAS_SETTINGS,
        ...floorMap.settings,
      });
    }

    const canvasUnits = savedUnits.map((unit) => ({
      id: unit._id,
      _id: unit._id,
      name: unit.name,
      type: unit.type,
      x: unit.position.x,
      y: unit.position.y,
      width: unit.position.width,
      height: unit.position.height,
      fill: unit.fill || "lightblue",
    }));

    commitUnits(canvasUnits);
    alert("Layout loaded from database!");
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