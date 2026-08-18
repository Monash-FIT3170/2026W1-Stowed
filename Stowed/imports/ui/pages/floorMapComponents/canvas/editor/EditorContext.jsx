import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { FloorMaps, StorageUnits, StorageLocations } from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";
import {
  buildRectShape,
  getBoundingBox,
  getTransformedBounds,
} from "/imports/api/locations/shapeUtils";
import { CANVAS_CONFIG } from "../CanvasConfig";

/**
 * Maps a StorageUnit to a the rectangle model the canvas currently renders.
 * The units real geometry is in its shape.points which is then transformed
 * use offset.rotation.scale.
 *
 * The x/y/width.height here are just the bounding box of the transformed points
 * as a stand in until the canvas can render different polygons
 */
function mapStorageUnitToCanvasUnit(unit) {
  const transform = { offset: unit.offset, rotation: unit.rotation, scale: unit.scale };
  const bounds = getTransformedBounds(unit.shape, transform);
  return {
    id: unit._id,
    _id: unit._id,
    name: unit.name,
    type: unit.type,
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    shape: unit.shape,
    offset: unit.offset,
    rotation: unit.rotation ?? 0,
    scale: unit.scale,
    fill: unit.fill || "#7a5230",
  };
}

// --- TOOL OPTIONS ---
export const TOOLS = {
  SELECT: "select",
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
 * @param {{ children: React.ReactNode, floorMapId: string, isCanvasEditMode: boolean, setCanvasEditMode: (v: boolean) => void }} props
 */
export function EditorProvider({ children, floorMapId, isCanvasEditMode, setCanvasEditMode }) {
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [floorSize, setFloorSize] = useState({ width: 500, height: 500 });
  const [canvasSettings, setCanvasSettings] = useState(DEFAULT_CANVAS_SETTINGS);
  const [isFloorMapSettingsOpen, setFloorMapSettingsOpen] = useState(false);
  const [isEditorSettingsOpen, setEditorSettingsOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [pendingUnit, setPendingUnit] = useState(null);

  // --- SLIDE-OUT PANEL STATE ---
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // --- UNDO / REDO HISTORY ---
  const [, forceRender] = useState(0);
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

    const activeFloorMap = floorMapId ? FloorMaps.findOne(floorMapId) : FloorMaps.findOne();

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

    const products = Products.find().fetch();
    const productRecords = ProductRecords.find().fetch();
    const storageLocations = StorageLocations.find().fetch();

    // Build map: unitId -> [{ product, quantity, threshold, isLow, locationName }]
    const map = {};

    productRecords.forEach((record) => {
      const product = products.find((p) => p._id === record.productId);
      if (!product) return;

      const location = storageLocations.find((l) => l._id === record.locationId);
      if (!location) return;

      const threshold = product.reorderAt ?? 0;
      const isLow = product.totalQuantity <= threshold;
      const unitId = location.storageUnitId;

      if (!map[unitId]) map[unitId] = [];

      map[unitId].push({
        product,
        quantity: product.totalQuantity,
        threshold,
        reorderAt: threshold,
        isLow,
        locationName: location.name,
      });
    });

    return { lowStockByUnitId: map };
  }, []);

  useEffect(() => {
    if (isLoading || !floorMap) return;

    const fw = Number(floorMap.floorSize?.width);
    const fh = Number(floorMap.floorSize?.height);
    if (fw > 0 && fh > 0) {
      setFloorSize({ width: fw, height: fh });
    }

    if (floorMap.settings) {
      setCanvasSettings({
        ...DEFAULT_CANVAS_SETTINGS,
        ...floorMap.settings,
      });
    }

    const canvasUnits = savedUnits.map(mapStorageUnitToCanvasUnit);

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

      const currentUnitIds = units.filter((unit) => unit._id).map((unit) => unit._id);

      for (const savedUnit of savedUnits) {
        if (!currentUnitIds.includes(savedUnit._id)) {
          await callMethod("storageUnits.delete", {
            storageUnitId: savedUnit._id,
          });
        }
      }

      const savedCanvasUnits = [];

      for (const unit of units) {
        if (unit._id) {
          // Recalculate all new transformations and update accordingly
          const loadedBounds = getTransformedBounds(unit.shape, {
            offset: unit.offset,
            rotation: unit.rotation,
            scale: unit.scale,
          });
          const newOffset = {
            x: unit.offset.x + (unit.x - loadedBounds.minX),
            y: unit.offset.y + (unit.y - loadedBounds.minY),
          };

          const rawBounds = getBoundingBox(unit.shape.points);
          const newScale = {
            x: rawBounds.width > 0 ? unit.width / rawBounds.width : (unit.scale?.x ?? 1),
            y: rawBounds.height > 0 ? unit.height / rawBounds.height : (unit.scale?.y ?? 1),
          };

          await callMethod("storageUnits.update", {
            storageUnitId: unit._id,
            floorMapId: activeFloorMapId,
            name: unit.name,
            type: unit.type || "other",
            shape: unit.shape,
            offset: newOffset,
            rotation: unit.rotation ?? 0,
            scale: newScale,
            fill: unit.fill || "#7a5230",
          });

          savedCanvasUnits.push({ ...unit, offset: newOffset, scale: newScale });
        } else {
          const hasCustomShape = Array.isArray(unit.shape?.points) && unit.shape.points.length >= 3;
          const shape = hasCustomShape
            ? unit.shape
            : buildRectShape({ width: unit.width, height: unit.height, name: unit.name });
          const offset = { x: Number(unit.x), y: Number(unit.y) };
          const scale = { x: 1, y: 1 };

          const newId = await callMethod("storageUnits.create", {
            floorMapId: activeFloorMapId,
            name: unit.name,
            type: unit.type || "other",
            shape,
            offset,
            rotation: 0,
            scale,
            fill: unit.fill || "#7a5230",
          });

          savedCanvasUnits.push({
            ...unit,
            _id: newId,
            id: newId,
            shape,
            offset,
            rotation: 0,
            scale,
          });
        }
      }

      setUnits(savedCanvasUnits);
      historyRef.current = { stack: [savedCanvasUnits], index: 0 };
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

    const lfw = Number(floorMap.floorSize?.width);
    const lfh = Number(floorMap.floorSize?.height);
    if (lfw > 0 && lfh > 0) {
      setFloorSize({ width: lfw, height: lfh });
    }

    if (floorMap.settings) {
      setCanvasSettings({
        ...DEFAULT_CANVAS_SETTINGS,
        ...floorMap.settings,
      });
    }

    const canvasUnits = savedUnits.map(mapStorageUnitToCanvasUnit);

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

  // --- FLOOR MAP SETTINGS ---
  function handleFloorMapSettingsSave({ floorSize: newFloorSize }) {
    const floorWidthMeters = newFloorSize.width / CANVAS_CONFIG.PIXELS_PER_METER;
    const floorHeightMeters = newFloorSize.height / CANVAS_CONFIG.PIXELS_PER_METER;
    const unitsInsideFloor = units.filter(
      (unit) =>
        unit.x >= 0 &&
        unit.y >= 0 &&
        unit.x + unit.width <= floorWidthMeters &&
        unit.y + unit.height <= floorHeightMeters,
    );
    const removedUnits = units.filter(
      (unit) => !unitsInsideFloor.some((insideUnit) => insideUnit.id === unit.id),
    );

    if (removedUnits.length > 0) {
      const unitNames = removedUnits.map((unit) => unit.name || unit.id).join(", ");
      const proceed = confirm(
        `The resized floor is too small for ${removedUnits.length} unit(s): ${unitNames}.\n\nDelete these unit(s) from the floor map?\n\nChoose Cancel to keep editing the floor size.`,
      );

      if (!proceed) return false;
      commitUnits(unitsInsideFloor);
    }

    setFloorSize(newFloorSize);
    return true;
  }

  // --- EDITOR SETTINGS ---
  function handleEditorSettingsSave({ gridInterval, showGrid, snapToGrid }) {
    setCanvasSettings({ gridInterval, showGrid, snapToGrid });
    return true;
  }

  async function handleDeleteSelectedUnit() {
    if (!selectedUnit) return;

    if (!selectedUnit._id) {
      commitUnits((prev) => prev.filter((u) => u.id !== selectedUnit.id));

      setSelectedUnit(null);
      return;
    }

    try {
      await callMethod("storageUnits.delete", {
        storageUnitId: selectedUnit._id,
      });

      commitUnits((prev) => prev.filter((u) => u._id !== selectedUnit._id));

      setSelectedUnit(null);
    } catch (error) {
      alert(
        error.reason ||
          "Cannot delete this unit. Make sure all storage locations within it are removed first.",
      );
    }
  }

  const value = {
    // Tool
    activeTool,
    setActiveTool,

    // Floor
    floorSize,
    setFloorSize,
    isFloorMapSettingsOpen,
    setFloorMapSettingsOpen,
    handleFloorMapSettingsSave,

    // Editor settings
    canvasSettings,
    isEditorSettingsOpen,
    setEditorSettingsOpen,
    handleEditorSettingsSave,

    // Mode toggling
    isCanvasEditMode,
    setCanvasEditMode,

    // Units
    units,
    commitUnits,
    pendingUnit,
    setPendingUnit,

    // History
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,

    // Save / load
    handleSaveLayout,
    handleLoadLayout,

    // Placement helpers
    handlePlaceUnit,
    handleUnitPlaced,

    // Low stock
    lowStockByUnitId,

    // Slide-out panel
    selectedUnit,
    setSelectedUnit,
    isPanelOpen,
    setIsPanelOpen,

    // Delete selected unit
    handleDeleteSelectedUnit,
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
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
