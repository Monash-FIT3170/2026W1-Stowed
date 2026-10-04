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
import { normaliseShapePoints } from "./utils/ShapeGeometry";
import { hasCollisions } from "./utils/Collisions";
import { COLOURS } from "../../FloorMapStyles";

function hasUsableShape(shape) {
  return Array.isArray(shape?.points) && shape.points.length >= 3;
}

function getFallbackShape(unit) {
  const width = Number(unit.width) > 0 ? Number(unit.width) : 1;
  const height = Number(unit.height) > 0 ? Number(unit.height) : 1;
  return buildRectShape({ width, height, name: unit.name || "Storage unit" });
}

function getDrawableShape(unit) {
  return hasUsableShape(unit.shape) ? unit.shape : getFallbackShape(unit);
}

function isUnitInsideFloor(unit, floorSize) {
  const widthMeters = floorSize.width / CANVAS_CONFIG.PIXELS_PER_METER;
  const heightMeters = floorSize.height / CANVAS_CONFIG.PIXELS_PER_METER;
  return (
    unit.x >= 0 &&
    unit.y >= 0 &&
    unit.x + unit.width <= widthMeters &&
    unit.y + unit.height <= heightMeters
  );
}

function hasStorageLocations(unit) {
  // Match storageUnits.delete: even an empty storage location prevents deletion.
  return Boolean(unit._id && StorageLocations.findOne({ storageUnitId: unit._id }));
}

function normalizeFloorSize(floorSize) {
  const width = Number(floorSize?.width);
  const height = Number(floorSize?.height);
  if (!(width > 0 && height > 0)) return null;

  const looksLikeMeters = width <= 100 && height <= 100;
  return looksLikeMeters
    ? {
      width: width * CANVAS_CONFIG.PIXELS_PER_METER,
      height: height * CANVAS_CONFIG.PIXELS_PER_METER,
    }
    : { width, height };
}

/**
 * Maps a StorageUnit to a the rectangle model the canvas currently renders.
 * The units real geometry is in its shape.points which is then transformed
 * use offset.rotation.scale.
 *
 * The x/y/width.height here are just the bounding box of the transformed points
 * as a stand in until the canvas can render different polygons
 */
function mapStorageUnitToCanvasUnit(unit) {
  const shape = getDrawableShape(unit);
  const offset = unit.offset ?? { x: 0, y: 0 };
  const scale = unit.scale ?? { x: 1, y: 1 };
  const transform = { offset, rotation: unit.rotation, scale };
  const bounds = getTransformedBounds(shape, transform);
  return {
    id: unit._id,
    _id: unit._id,
    name: unit.name,
    type: unit.type,
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    shape,
    offset,
    rotation: unit.rotation ?? 0,
    scale: unit.scale,
    fill: unit.fill || COLOURS.UNIT_DEFAULT,
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
  snapInterval: CANVAS_CONFIG.DEFAULT_SNAP_INTERVAL,
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
  const loadedFloorMapIdRef = useRef(null);
  const creatingUnitIdsRef = useRef(new Set());
  const canUndo = historyRef.current.index > 0;
  const canRedo = historyRef.current.index < historyRef.current.stack.length - 1;

  function commitUnits(updater) {
    const { stack, index } = historyRef.current;
    const currentUnits = stack[index];
    const next = typeof updater === "function" ? updater(currentUnits) : updater;

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
        quantity: record.quantity,
        threshold,
        reorderAt: threshold,
        isLow,
        locationName: location.name,
        locationId: record.locationId,
      });
    });

    return { lowStockByUnitId: map };
  }, []);

  useEffect(() => {
    if (isLoading || !floorMap) return;

    // Initialise each map once. Database updates must not overwrite local edits.
    if (loadedFloorMapIdRef.current === floorMap._id) return;
    loadedFloorMapIdRef.current = floorMap._id;

    const nextFloorSize = normalizeFloorSize(floorMap.floorSize);
    if (nextFloorSize) {
      setFloorSize(nextFloorSize);
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
  }, [isLoading, floorMap, savedUnits]);

  // --- SAVE / LOAD ---
  function callMethod(methodName, params) {
    return new Promise((resolve, reject) => {
      Meteor.call(methodName, params, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  async function handleSaveLayout({ showSuccessAlert = true } = {}) {
    if (isLoading) {
      alert("Please wait for the floor map and storage locations to finish loading.");
      return false;
    }
    if (creatingUnitIdsRef.current.size > 0) {
      alert("Please wait for new units to finish being created, then save again.");
      return false;
    }
    if (!floorMap) {
      alert("No floor map exists in database.");
      return false;
    }

    const activeFloorMapId = floorMap._id;

    const { stack, index } = historyRef.current;
    const unitsToSave = stack[index];
    const currentUnitIds = new Set(unitsToSave.map((unit) => unit._id).filter(Boolean));
    const unitsToDelete = savedUnits.filter((unit) => !currentUnitIds.has(unit._id));
    const blockedUnits = unitsToDelete.filter(hasStorageLocations);

    // Validate every removal before writing anything, including removals from undo/redo.
    if (blockedUnits.length > 0) {
      const unitNames = blockedUnits.map((unit) => unit.name || unit._id).join(", ");
      alert(
        `Cannot save the layout because these units still contain storage locations: ${unitNames}.\n\nRestore the units or remove their storage locations before saving.`,
      );
      return false;
    }

    if (unitsToSave.some((unit) => !isUnitInsideFloor(unit, floorSize))) {
      alert(
        "Cannot save the layout while units are outside the floor. Move them inside or increase the floor size.",
      );
      return false;
    }

    try {
      for (const savedUnit of unitsToDelete) {
        await callMethod("storageUnits.delete", {
          storageUnitId: savedUnit._id,
        });
      }

      const savedCanvasUnits = [];

      for (const unit of unitsToSave) {
        const shape = getDrawableShape(unit);
        const offset = unit.offset ?? { x: 0, y: 0 };
        const scale = unit.scale ?? { x: 1, y: 1 };

        if (unit._id) {
          // Recalculate all new transformations and update accordingly
          const loadedBounds = getTransformedBounds(shape, {
            offset,
            rotation: unit.rotation,
            scale,
          });
          const newOffset = {
            x: offset.x + (unit.x - loadedBounds.minX),
            y: offset.y + (unit.y - loadedBounds.minY),
          };

          const rawBounds = getBoundingBox(shape.points);
          const newScale = {
            x: rawBounds.width > 0 ? unit.width / rawBounds.width : scale.x,
            y: rawBounds.height > 0 ? unit.height / rawBounds.height : scale.y,
          };

          await callMethod("storageUnits.update", {
            storageUnitId: unit._id,
            floorMapId: activeFloorMapId,
            name: unit.name,
            type: unit.type || "other",
            shape,
            offset: newOffset,
            rotation: unit.rotation ?? 0,
            scale: newScale,
            fill: unit.fill || COLOURS.UNIT_DEFAULT,
          });

          savedCanvasUnits.push({ ...unit, shape, offset: newOffset, scale: newScale });
        } else {
          const newOffset = { x: Number(unit.x), y: Number(unit.y) };
          const newScale = { x: 1, y: 1 };

          const newId = await callMethod("storageUnits.create", {
            floorMapId: activeFloorMapId,
            name: unit.name,
            type: unit.type || "other",
            shape,
            offset: newOffset,
            rotation: 0,
            scale,
            fill: unit.fill || COLOURS.UNIT_DEFAULT,
          });

          savedCanvasUnits.push({
            ...unit,
            _id: newId,
            id: newId,
            shape,
            offset: newOffset,
            rotation: 0,
            scale: newScale,
          });
        }
      }

      // Persist dimensions only after all unit operations succeed. A server-side
      // deletion rejection (e.g. a newly added location) must not shrink the floor.
      await callMethod("floorMaps.update", {
        floorMapId: activeFloorMapId,
        siteId: floorMap.siteId,
        name: floorMap.name,
        imageUrl: floorMap.imageUrl || "",
        floorSize,
        settings: canvasSettings,
      });

      setUnits(savedCanvasUnits);
      historyRef.current = { stack: [savedCanvasUnits], index: 0 };

      if (showSuccessAlert) alert("Layout saved to database!");
      return true;
    } catch (error) {
      console.error(error);
      alert(error.reason || "Failed to save layout.");
      return false;
    }
  }

  function handleLoadLayout() {
    if (!floorMap) {
      alert("No floor map found.");
      return;
    }

    const nextFloorSize = normalizeFloorSize(floorMap.floorSize);
    if (nextFloorSize) {
      setFloorSize(nextFloorSize);
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
  async function handleUnitPlaced() {
    if (!floorMap) {
      alert("No floor map exists in database.");
      return;
    }

    const { stack, index } = historyRef.current;
    const pendingIds = stack[index].filter((unit) => !unit._id).map((unit) => unit.id);

    for (const id of pendingIds) {
      const history = historyRef.current;
      const unit = history.stack[history.index].find((item) => item.id === id);

      if (!unit || unit._id || creatingUnitIdsRef.current.has(id)) continue;

      creatingUnitIdsRef.current.add(id);

      try {
        const shape = getDrawableShape(unit);
        const offset = unit.offset ?? { x: Number(unit.x), y: Number(unit.y) };
        const scale = unit.scale ?? { x: 1, y: 1 };

        const newId = await callMethod("storageUnits.create", {
          floorMapId: floorMap._id,
          name: unit.name,
          type: unit.type || "other",
          shape,
          offset,
          rotation: unit.rotation ?? 0,
          scale,
          fill: unit.fill || COLOURS.UNIT_DEFAULT,
        });

        // Attach the database ID without overwriting newer movements or renames.
        // Keep the canvas ID stable so selection continues to work.
        const attachDatabaseId = (item) =>
          item.id === id ? { ...item, _id: newId, offset: item.offset ?? offset } : item;

        // Update all snapshots so undo/redo retains the database identity.
        const latestHistory = historyRef.current;
        const nextStack = latestHistory.stack.map((snapshot) => snapshot.map(attachDatabaseId));

        historyRef.current = {
          stack: nextStack,
          index: latestHistory.index,
        };

        setUnits(nextStack[latestHistory.index]);
        setSelectedUnit((current) => (current ? attachDatabaseId(current) : current));
      } catch (error) {
        console.error(error);
        alert(error.reason || "Failed to create unit.");
      } finally {
        creatingUnitIdsRef.current.delete(id);
      }
    }
  }

  // --- FLOOR MAP SETTINGS ---
  function handleFloorMapSettingsSave({ floorSize: newFloorSize }) {
    if (isLoading) {
      alert("Please wait for the floor map and storage locations to finish loading.");
      return false;
    }
    if (creatingUnitIdsRef.current.size > 0) {
      alert("Please wait for new units to finish being created, then resize again.");
      return false;
    }

    const unitsInsideFloor = units.filter((unit) => isUnitInsideFloor(unit, newFloorSize));
    const removedUnits = units.filter(
      (unit) => !unitsInsideFloor.some((insideUnit) => insideUnit.id === unit.id),
    );
    const blockedUnits = removedUnits.filter(hasStorageLocations);

    if (blockedUnits.length > 0) {
      const unitNames = blockedUnits.map((unit) => unit.name || unit.id).join(", ");
      alert(
        `Cannot resize the floor because these units would be outside its bounds and still contain storage locations: ${unitNames}.\n\nMove these units inside the new bounds, choose a larger floor size, or remove their storage locations first.`,
      );
      return false;
    }

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
  function handleEditorSettingsSave({ gridInterval, snapInterval, showGrid, snapToGrid }) {
    setCanvasSettings({ gridInterval, snapInterval, showGrid, snapToGrid });
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

  async function handleChangeShape(shape) {
    if (!selectedUnit) return;

    // normalise custom shapes whose points can have huge variation
    const normalisedPoints = normaliseShapePoints(shape.points);

    const normalisedShape = {
      ...shape,
      points: normalisedPoints,
    };

    // updates unit details based on new shape
    const newBounds = getTransformedBounds(normalisedShape, {
      offset: selectedUnit.offset,
      rotation: selectedUnit.rotation,
      scale: selectedUnit.scale,
    });

    const updatedUnit = {
      ...selectedUnit,
      shape: normalisedShape,
      x: selectedUnit.x,
      y: selectedUnit.y,
      width: newBounds.width,
      height: newBounds.height,
    };

    // block change if it causes a collision
    if (hasCollisions(updatedUnit, units, selectedUnit._id)) {
      alert("Cannot change to this shape because it would cause collisions.");
      return;
    }

    // updates unsaved map configs
    if (!selectedUnit._id) {
      commitUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? updatedUnit : u)));
      setSelectedUnit(updatedUnit);
      return;
    }

    try {
      await callMethod("storageUnits.update", {
        storageUnitId: selectedUnit._id,
        floorMapId: floorMap._id,
        name: selectedUnit.name,
        type: selectedUnit.type,
        shape: normalisedShape,
        offset: selectedUnit.offset,
        rotation: selectedUnit.rotation,
        scale: selectedUnit.scale,
        fill: selectedUnit.fill,
      });

      // update view
      commitUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? updatedUnit : u)));

      setSelectedUnit(updatedUnit);
    } catch (error) {
      alert(error.reason || "Ensure that a valid shape has been selected to change to.");
    }
  }

  async function handleDeleteShape(shape) {
    // validate something is selected
    if (!shape) return;

    try {
      await callMethod("mapShapes.delete", { shape });
    } catch (error) {
      alert(
        error.reason ||
        "Cannot delete this shape. Make sure it is not used for any storage units first.",
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
    handleChangeShape,

    // Delete selected shape
    handleDeleteShape,
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
