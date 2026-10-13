import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import {
  FloorMaps,
  StorageUnits,
  StorageLocations,
  FloorMapRoutes,
} from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";
import {
  buildRectShape,
  getBoundingBox,
  getTransformedBounds,
} from "/imports/api/locations/shapeUtils";
import { CANVAS_CONFIG } from "../CanvasConfig";
import { mapStorageUnitToCanvasUnit, normalizeFloorSize } from "./mapLayout";
import { normaliseShapePoints } from "./utils/ShapeGeometry";
import { hasCollisions } from "./utils/Collisions";
import {
  canLinkNodes,
  removeNodes,
  splitLink,
  ROUTE_NODE_TYPES,
} from "/imports/api/locations/routeGraph";
import { COLOURS } from "../../FloorMapStyles";

function getDrawableShape(unit) {
  return Array.isArray(unit.shape?.points) && unit.shape.points.length >= 3
    ? unit.shape
    : buildRectShape({
        width: Number(unit.width) > 0 ? Number(unit.width) : 1,
        height: Number(unit.height) > 0 ? Number(unit.height) : 1,
        name: unit.name || "Storage unit",
      });
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

/** The modes the floor map page can be in. */
export const CANVAS_MODES = {
  VIEW: "view", // read-only floor plan with stock overlays
  EDIT: "edit", // edit layout, storage units and their contents
  ROUTE: "route", // edit walkway nodes and links for product routing
};

/** The tools available in route mode. `null` means no tool is selected. */
export const ROUTE_TOOLS = {
  WALKWAY_NODE: "walkwayNode", // a point on a walkway
  LINK: "link", // connects two nodes
  PRODUCT_NODE: "productNode", // a pick point on the side of a storage unit
  DELETE: "delete", // removes a node (and its links) or a single link
};

/** Client-side id for route nodes and links until they are persisted. */
function createRouteId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EditorContext = createContext(null);

/**
 * Top level context provider for the floor plan editor.
 * Owns all shared editor state: active tool, floor dimensions, canvas settings,
 * placed units, undo/redo history, save/load, and low stock alert data.
 *
 * Pages with all three modes pass `canvasMode` / `setCanvasMode`. Read-only pages may instead pass
 * `isCanvasEditMode` / `setCanvasEditMode`, which map to view and edit mode.
 * `publicOrgCode` loads the public floor maps of that organisation (customer pages).
 *
 * @param {{ children: React.ReactNode, floorMapId: string, canvasMode?: string, setCanvasMode?: (mode: string) => void, isCanvasEditMode?: boolean, setCanvasEditMode?: (v: boolean) => void, publicOrgCode?: string }} props
 */
export function EditorProvider({
  children,
  floorMapId,
  canvasMode: canvasModeProp,
  setCanvasMode: setCanvasModeProp,
  isCanvasEditMode: isCanvasEditModeProp = false,
  setCanvasEditMode,
  publicOrgCode,
}) {
  const canvasMode =
    canvasModeProp ?? (isCanvasEditModeProp ? CANVAS_MODES.EDIT : CANVAS_MODES.VIEW);
  const setCanvasMode =
    setCanvasModeProp ?? ((mode) => setCanvasEditMode?.(mode === CANVAS_MODES.EDIT));
  const isCanvasEditMode = canvasMode === CANVAS_MODES.EDIT;
  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [activeRouteTool, setActiveRouteTool] = useState(null);
  // First node picked by the link tool, waiting for a second node
  const [pendingLinkNodeId, setPendingLinkNodeId] = useState(null);
  // Product node whose storage locations are being chosen: { nodeId, isNew } or null.
  // `isNew` means it was just placed, so cancelling removes it again.
  const [editingProductNode, setEditingProductNode] = useState(null);
  // Walkway nodes for routing, positioned in metres: [{ id, x, y }]
  const [walkwayNodes, setWalkwayNodes] = useState([]);
  // Undirected links between walkway nodes: [{ id, fromId, toId }]
  const [walkwayLinks, setWalkwayLinks] = useState([]);
  // True when the route has changes that have not been saved to the database
  const [isRouteDirty, setIsRouteDirty] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [floorSize, setFloorSize] = useState(CANVAS_CONFIG.DEFAULT_FLOOR_SIZE);
  const [canvasSettings, setCanvasSettings] = useState(DEFAULT_CANVAS_SETTINGS);
  const [isFloorMapSettingsOpen, setFloorMapSettingsOpen] = useState(false);
  const [isEditorSettingsOpen, setEditorSettingsOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [pendingUnit, setPendingUnit] = useState(null);
  const [unitPendingDelete, setUnitPendingDelete] = useState(null);
  const [shapePendingDelete, setShapePendingDelete] = useState(null);

  // --- SLIDE-OUT PANEL STATE ---
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // --- UNDO / REDO HISTORY ---
  const [, forceRender] = useState(0);
  const historyRef = useRef({ stack: [[]], index: 0 });
  const loadedFloorMapIdRef = useRef(null);
  const creatingUnitIdsRef = useRef(new Set());
  const canUndo = historyRef.current.index > 0;

  // History is reset on load and on save, so any undoable step is an unsaved unit change.
  // Floor size and editor settings are also saved by Save Layout, so track those separately.
  const [hasUnsavedLayoutSettings, setHasUnsavedLayoutSettings] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const isLayoutDirty = canUndo || hasUnsavedLayoutSettings;
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

  // --- FLOOR MAP + UNITS + ROUTE FROM MONGODB ---
  const { isLoading, floorMap, savedUnits, savedRoute } = useTracker(() => {
    const handle =
      publicOrgCode !== undefined
        ? Meteor.subscribe("locations.publicFloorMaps", publicOrgCode ?? "")
        : Meteor.subscribe("locations.all");

    const activeFloorMap = floorMapId ? FloorMaps.findOne(floorMapId) : FloorMaps.findOne();

    const activeFloorMapId = activeFloorMap?._id;

    return {
      isLoading: !handle.ready(),
      floorMap: activeFloorMap,
      savedUnits: activeFloorMapId
        ? StorageUnits.find({ floorMapId: activeFloorMapId }).fetch()
        : [],
      savedRoute: activeFloorMapId
        ? FloorMapRoutes.findOne({ floorMapId: activeFloorMapId })
        : null,
    };
  }, [floorMapId, publicOrgCode]);

  // Load the saved route once per floor map. Later database updates are deliberately not
  // re-applied, so they can never overwrite unsaved route edits.
  // (EditorProvider remounts when the floor map changes, which resets this.)
  const hasLoadedRouteRef = useRef(false);
  useEffect(() => {
    if (isLoading || !floorMap || hasLoadedRouteRef.current) return;
    hasLoadedRouteRef.current = true;
    setWalkwayNodes(savedRoute?.nodes ?? []);
    setWalkwayLinks(savedRoute?.links ?? []);
    setIsRouteDirty(false);
  }, [isLoading, floorMap, savedRoute]);

  // --- LOW STOCK DATA ---
  const { lowStockByUnitId } = useTracker(() => {
    if (publicOrgCode !== undefined) return { lowStockByUnitId: {} };
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
  }, [publicOrgCode]);

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
    setHasUnsavedLayoutSettings(false);
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

    setIsSavingLayout(true);
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
      setHasUnsavedLayoutSettings(false);

      if (showSuccessAlert) alert("Layout saved to database!");
      return true;
    } catch (error) {
      console.error(error);
      alert(error.reason || "Failed to save layout.");
      return false;
    } finally {
      setIsSavingLayout(false);
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
    setHasUnsavedLayoutSettings(true);
    return true;
  }

  // --- ROUTE TOOLS ---
  /**
   * Switches the active route tool (or clears it with null), dropping any half-finished link.
   *
   * @param {string | null} tool - One of ROUTE_TOOLS, or null
   */
  function selectRouteTool(tool) {
    setActiveRouteTool(tool);
    setPendingLinkNodeId(null);
  }

  // --- WALKWAY ROUTE ---
  /** Adds a node and returns its new id. */
  function addRouteNode(node) {
    const id = createRouteId(node.type);
    setWalkwayNodes((prev) => [...prev, { id, ...node }]);
    setIsRouteDirty(true);
    return id;
  }

  /**
   * Adds a walkway node at the given position (in metres). Saved with handleSaveRoute.
   *
   * @param {{ x: number, y: number }} position
   */
  function addWalkwayNode({ x, y }) {
    addRouteNode({ type: ROUTE_NODE_TYPES.WALKWAY, x, y });
  }

  /**
   * Adds a product node on the side of a storage unit, then asks the user which of the unit's
   * storage locations can be reached from it (see editingProductNode). Saved with handleSaveRoute.
   *
   * @param {{ x: number, y: number, storageUnitId: string }} placement - Position in metres
   */
  function addProductNode({ x, y, storageUnitId }) {
    const nodeId = addRouteNode({
      type: ROUTE_NODE_TYPES.PRODUCT,
      x,
      y,
      storageUnitId,
      storageLocationIds: [],
    });
    setEditingProductNode({ nodeId, isNew: true });
  }

  /**
   * Opens the storage location picker for an existing product node.
   *
   * @param {string} nodeId
   */
  function editProductNode(nodeId) {
    setEditingProductNode({ nodeId, isNew: false });
  }

  /**
   * Saves the chosen storage locations for the product node being edited and closes the picker.
   *
   * @param {string[]} storageLocationIds - Locations within the node's storage unit
   */
  function confirmProductNodeLocations(storageLocationIds) {
    if (!editingProductNode) return;
    const { nodeId } = editingProductNode;
    setWalkwayNodes((prev) =>
      prev.map((node) => (node.id === nodeId ? { ...node, storageLocationIds } : node)),
    );
    setIsRouteDirty(true);
    setEditingProductNode(null);
  }

  /**
   * Closes the storage location picker. A node that was only just placed is removed again,
   * so every product node always has its accessible locations chosen.
   */
  function cancelProductNodeEdit() {
    if (editingProductNode?.isNew) removeRouteNode(editingProductNode.nodeId);
    setEditingProductNode(null);
  }

  /** Removes a node and every link attached to it from the in-page route. */
  function removeRouteNode(nodeId) {
    const { nodes, links } = removeNodes(walkwayNodes, walkwayLinks, (node) => node.id === nodeId);
    setWalkwayNodes(nodes);
    setWalkwayLinks(links);
  }

  /**
   * Deletes a node (walkway or product) together with every link attached to it.
   * Saved with handleSaveRoute.
   *
   * @param {string} nodeId
   */
  function deleteRouteNode(nodeId) {
    removeRouteNode(nodeId);
    setIsRouteDirty(true);
  }

  /**
   * Deletes a single link, keeping the nodes at both ends. Saved with handleSaveRoute.
   *
   * @param {string} linkId
   */
  function deleteRouteLink(linkId) {
    setWalkwayLinks((prev) => prev.filter((link) => link.id !== linkId));
    setIsRouteDirty(true);
  }

  /**
   * Links two nodes. Ignored if they are the same node, already linked, or both product nodes.
   * Saved with handleSaveRoute.
   *
   * @param {string} fromId
   * @param {string} toId
   * @returns {boolean} Whether a link was added
   */
  function addWalkwayLink(fromId, toId) {
    if (!canLinkNodes(walkwayNodes, walkwayLinks, fromId, toId)) return false;
    setWalkwayLinks((prev) => [...prev, { id: createRouteId("link"), fromId, toId }]);
    setIsRouteDirty(true);
    return true;
  }

  /**
   * Connects a node onto the middle of an existing link: the link is split at `point` by a new
   * walkway node, which is then linked to `nodeId`. Saved with handleSaveRoute.
   *
   * @param {string} nodeId - The node to connect (usually a product node)
   * @param {string} linkId - The link to split
   * @param {{ x: number, y: number }} point - Where on the link to insert the junction (metres)
   * @returns {boolean} Whether the link was split
   */
  function linkNodeOntoLink(nodeId, linkId, point) {
    const split = splitLink(walkwayNodes, walkwayLinks, linkId, point, {
      nodeId: createRouteId(ROUTE_NODE_TYPES.WALKWAY),
      linkIdA: createRouteId("link"),
      linkIdB: createRouteId("link"),
    });
    if (!split) return false;

    const junctionId = split.nodes.at(-1).id;
    setWalkwayNodes(split.nodes);
    setWalkwayLinks([
      ...split.links,
      { id: createRouteId("link"), fromId: nodeId, toId: junctionId },
    ]);
    setIsRouteDirty(true);
    return true;
  }

  /**
   * Saves the current walkway nodes and links for this floor map, replacing the saved route.
   */
  async function handleSaveRoute() {
    if (!floorMap) {
      alert("No floor map exists in database.");
      return;
    }

    // Drop product nodes whose storage unit has since been deleted, so they can't block the save
    const savedUnitIds = new Set(savedUnits.map((unit) => unit._id));
    const { nodes: remainingNodes, links } = removeNodes(
      walkwayNodes,
      walkwayLinks,
      (node) => Boolean(node.storageUnitId) && !savedUnitIds.has(node.storageUnitId),
    );

    // Likewise drop storage locations that were deleted or moved to another unit
    const unitIdByLocationId = new Map(
      StorageLocations.find({}, { fields: { storageUnitId: 1 } })
        .fetch()
        .map((location) => [location._id, location.storageUnitId]),
    );
    const nodes = remainingNodes.map((node) =>
      node.storageLocationIds
        ? {
            ...node,
            storageLocationIds: node.storageLocationIds.filter(
              (id) => unitIdByLocationId.get(id) === node.storageUnitId,
            ),
          }
        : node,
    );

    setIsSavingRoute(true);
    try {
      await callMethod("floorMapRoutes.save", { floorMapId: floorMap._id, nodes, links });
      setWalkwayNodes(nodes);
      setWalkwayLinks(links);
      setIsRouteDirty(false);
    } catch (error) {
      console.error(error);
      alert(error.reason || "Failed to save route.");
    } finally {
      setIsSavingRoute(false);
    }
  }

  // --- EDITOR SETTINGS ---
  function handleEditorSettingsSave({ gridInterval, snapInterval, showGrid, snapToGrid }) {
    setCanvasSettings({ gridInterval, snapInterval, showGrid, snapToGrid });
    setHasUnsavedLayoutSettings(true); // editor settings are saved with the layout
    return true;
  }

  async function handleDeleteSelectedUnit() {
    if (!selectedUnit) return;

    if (!selectedUnit._id) {
      commitUnits((prev) => prev.filter((u) => u.id !== selectedUnit.id));

      setSelectedUnit(null);
      return;
    }

    if (StorageLocations.find({ storageUnitId: selectedUnit._id }).count() > 0) {
      setUnitPendingDelete(selectedUnit);
      return;
    }

    try {
      await callMethod("storageUnits.delete", {
        storageUnitId: selectedUnit._id,
      });

      commitUnits((prev) => prev.filter((u) => u._id !== selectedUnit._id));

      setSelectedUnit(null);
    } catch (error) {
      alert(error.reason || "Failed to delete this unit.");
    }
  }

  async function handleConfirmDeleteWithReassign(assignments) {
    const unit = unitPendingDelete;
    if (!unit) return;

    await callMethod("storageUnits.deleteWithReassign", {
      storageUnitId: unit._id,
      assignments,
    });

    commitUnits((prev) => prev.filter((u) => u._id !== unit._id));
    setSelectedUnit(null);
    setUnitPendingDelete(null);
  }

  const unitIdsStagedForRemoval = savedUnits
    .filter((saved) => !units.some((u) => u._id === saved._id))
    .map((saved) => saved._id);

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
    if (!shape) return;

    if (StorageUnits.find({ "shape.shapeId": shape.shapeId }).count() > 0) {
      setShapePendingDelete(shape);
      return;
    }

    try {
      await callMethod("mapShapes.delete", { shape });
    } catch (error) {
      alert(error.reason || "Failed to delete this shape.");
    }
  }

  async function handleConfirmDeleteShapeWithReassign(assignments) {
    const shape = shapePendingDelete;
    if (!shape) return;

    await callMethod("mapShapes.deleteWithReassign", {
      shapeId: shape.shapeId,
      assignments,
    });

    setShapePendingDelete(null);
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
    canvasMode,
    setCanvasMode,
    isCanvasEditMode,

    // Route mode
    activeRouteTool,
    selectRouteTool,
    pendingLinkNodeId,
    setPendingLinkNodeId,
    walkwayNodes,
    addWalkwayNode,
    addProductNode,
    editingProductNode,
    editProductNode,
    confirmProductNodeLocations,
    cancelProductNodeEdit,
    deleteRouteNode,
    deleteRouteLink,
    walkwayLinks,
    addWalkwayLink,
    linkNodeOntoLink,
    isRouteDirty,
    isSavingRoute,
    handleSaveRoute,

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
    isLayoutDirty,
    isSavingLayout,
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
    unitPendingDelete,
    setUnitPendingDelete,
    unitIdsStagedForRemoval,
    handleConfirmDeleteWithReassign,
    handleChangeShape,

    // Delete selected shape
    handleDeleteShape,
    shapePendingDelete,
    setShapePendingDelete,
    handleConfirmDeleteShapeWithReassign,
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
