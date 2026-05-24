import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { FloorMaps, StorageUnits, StorageLocations } from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";
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
 * placed units, undo/redo history, save/load, and low stock alert data.
 *
 * @param {{ children: React.ReactNode, floorMapId: string }} props
 */
export function EditorProvider({ children, floorMapId }) {
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize] = useState({ width: 500, height: 500 });
  const [canvasSettings, setCanvasSettings] = useState(DEFAULT_CANVAS_SETTINGS);
  const [isCanvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [isCanvasEditMode, setCanvasEditMode] = useState(false);
  const [units, setUnits] = useState([]);
  const [pendingUnit, setPendingUnit] = useState(null);

  // --- SLIDE-OUT PANEL STATE ---
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [isPanelOpen, setIsPanelOpen]   = useState(false);

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

  // --- FLOOR MAP + UNITS FROM MONGODB ---
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

  // --- LOW STOCK DATA ---
  const { lowStockByUnitId } = useTracker(() => {
    Meteor.subscribe("products");
    Meteor.subscribe("productRecords");
    Meteor.subscribe("locations.all");

    const products         = Products.find().fetch();
    const productRecords   = ProductRecords.find().fetch();
    const storageLocations = StorageLocations.find().fetch();

    // Build map: unitId -> [{ product, quantity, threshold, isLow, locationName }]
    const map = {};

    productRecords.forEach((record) => {
      const product  = products.find((p) => p._id === record.productId);
      if (!product) return;

      const location = storageLocations.find((l) => l._id === record.locationId);
      if (!location) return;

      const threshold = product.reorderAt ?? 10;
      const isLow     = product.totalQuantity <= threshold;
      const unitId    = location.storageUnitId;

      if (!map[unitId]) map[unitId] = [];

      map[unitId].push({
        product,
        quantity:     product.totalQuantity,
        threshold,
        isLow,
        locationName: location.name,
      });
    });

    return { lowStockByUnitId: map };
  }, []);

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

    // Normalise coordinates — units created via Locations page may be stored
    // in pixels (large values), while floor map editor stores in meters.
    // Threshold: if x or y or w or h > 20, assume pixels and convert to meters.
    const PX_PER_M = 50;
    const canvasUnits = savedUnits.map((unit) => {
      const x = unit.position.x;
      const y = unit.position.y;
      const w = unit.position.width;
      const h = unit.position.height;
      const isPixels = x > 20 || y > 20 || w > 20 || h > 20;
      return {
        id:     unit._id,
        _id:    unit._id,
        name:   unit.name,
        type:   unit.type,
        x:      isPixels ? x / PX_PER_M : x,
        y:      isPixels ? y / PX_PER_M : y,
        width:  isPixels ? w / PX_PER_M : w,
        height: isPixels ? h / PX_PER_M : h,
        fill:   unit.fill || "lightblue",
      };
    });

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
        siteId:     floorMap.siteId,
        name:       floorMap.name,
        imageUrl:   floorMap.imageUrl || "",
        floorSize,
        settings:   canvasSettings,
      });

      for (const unit of units) {
        const position = {
          x:      unit.x,
          y:      unit.y,
          width:  unit.width,
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

      const savedCanvasUnits = [];

      for (const unit of units) {
        const position = {
          x: unit.x,
          y: unit.y,
          width: unit.width,
          height: unit.height,
        };

        if (unit._id) {
          await callMethod("storageUnits.update", {
            storageUnitId: unit._id,
            floorMapId:    activeFloorMapId,
            name:          unit.name,
            type:          unit.type || "other",
            position,
            fill:          unit.fill || "lightblue",
          });

          savedCanvasUnits.push(unit);
        } else {
          const newId = await callMethod("storageUnits.create", {
            floorMapId: activeFloorMapId,
            name:       unit.name,
            type:       unit.type || "other",
            position,
            fill:       unit.fill || "lightblue",
          });

          savedCanvasUnits.push({
            ...unit,
            _id: newId,
            id: newId,
          });
        }
      }

      setUnits(savedCanvasUnits);
      historyRef.current = { stack: [savedCanvasUnits], index: 0 };
      alert("Layout saved to database!");
    }
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

    const PX_PER_M = 50;
    const canvasUnits = savedUnits.map((unit) => {
      const x = unit.position.x;
      const y = unit.position.y;
      const w = unit.position.width;
      const h = unit.position.height;
      const isPixels = x > 20 || y > 20 || w > 20 || h > 20;
      return {
        id:     unit._id,
        _id:    unit._id,
        name:   unit.name,
        type:   unit.type,
        x:      isPixels ? x / PX_PER_M : x,
        y:      isPixels ? y / PX_PER_M : y,
        width:  isPixels ? w / PX_PER_M : w,
        height: isPixels ? h / PX_PER_M : h,
        fill:   unit.fill || "lightblue",
      };
    });

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
    const floorWidthMeters = newFloorSize.width / CANVAS_CONFIG.PIXELS_PER_METER;
    const floorHeightMeters = newFloorSize.height / CANVAS_CONFIG.PIXELS_PER_METER;
    const unitsInsideFloor = units.filter(
      (unit) =>
        unit.x >= 0 &&
        unit.y >= 0 &&
        unit.x + unit.width <= floorWidthMeters &&
        unit.y + unit.height <= floorHeightMeters
    );
    const removedUnits = units.filter(
      (unit) => !unitsInsideFloor.some((insideUnit) => insideUnit.id === unit.id)
    );

    if (removedUnits.length > 0) {
      const unitNames = removedUnits.map((unit) => unit.name || unit.id).join(", ");
      const proceed = confirm(
        `The resized floor is too small for ${removedUnits.length} unit(s): ${unitNames}.\n\nDelete these unit(s) from the floor map?\n\nChoose Cancel to keep editing the floor size.`
      );

      if (!proceed) return false;
      commitUnits(unitsInsideFloor);
    }

    setFloorSize(newFloorSize);
    setCanvasSettings({ gridInterval, showGrid, snapToGrid });
    return true;
  }

  async function handleDeleteSelectedUnit() {
    if (!selectedUnit) return;
    const unitId = selectedUnit._id || selectedUnit.id;
    if (!unitId) {
      // Unit not saved to DB yet — just remove from canvas
      commitUnits((prev) => prev.filter((u) => u.id !== selectedUnit.id && u._id !== selectedUnit._id));
      setSelectedUnit(null);
      return;
    }
    try {
      await callMethod("storageUnits.delete", { storageUnitId: unitId });
      commitUnits((prev) => prev.filter((u) => u._id !== unitId && u.id !== unitId));
      setSelectedUnit(null);
    } catch (error) {
      alert(error.reason || "Cannot delete this unit. Make sure all storage locations within it are removed first.");
    }
  }

  const value = {
    // Tool
    activeTool, setActiveTool,

    // Floor
    floorSize, setFloorSize,

    // Canvas settings
    canvasSettings, isCanvasSettingsOpen, setCanvasSettingsOpen, handleCanvasSettingsSave,

    // Mode toggling
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

    // Low stock
    lowStockByUnitId,

    // Slide-out panel
    selectedUnit, setSelectedUnit,
    isPanelOpen,  setIsPanelOpen,

    // Delete selected unit
    handleDeleteSelectedUnit,
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
