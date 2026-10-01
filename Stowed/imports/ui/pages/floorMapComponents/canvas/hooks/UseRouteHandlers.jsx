import { useCallback, useEffect, useState } from "react";
import { useEditor, CANVAS_MODES, ROUTE_TOOLS } from "../editor/EditorContext";
import { snapToGrid } from "../editor/utils/Snapping";
import { closestPointOnSegment, findNearestUnitEdgePoint } from "../editor/utils/UnitEdges";
import {
  canLinkNodes,
  getLinkedNodeIds,
  isProductNode,
  ROUTE_NODE_TYPES,
} from "/imports/api/locations/routeGraph";
import { CANVAS_CONFIG } from "../CanvasConfig";
import { GRID_LAYER_NAME } from "../components/layers/GridLayer";
import { ROUTE_LAYER_NAME } from "../components/layers/RouteLayer";

/**
 * Custom hook that provides the canvas event handlers and preview state for route mode tools.
 *
 * - Walkway node tool: click empty floor to place a node (snapped to the grid if enabled).
 * - Product node tool: click near a saved storage unit to place a node on its nearest side,
 *   then choose which of the unit's storage locations can be reached from it.
 * - No tool: click a product node to change which storage locations it gives access to.
 * - Link tool: click one node, then another, to link them. Once a product node is picked, it can
 *   also be linked onto the middle of a walkway link, which splits that link with a new junction
 *   node. Clicks anywhere else are ignored. Clicking the first node again, or Escape, cancels.
 *
 * @param {React.Ref} stageRef
 * @param {boolean}   snapEnabled
 * @param {number}    snapSizePx - Snap interval in pixels
 * @param {number}    width      - Floor width in pixels
 * @param {number}    height     - Floor height in pixels
 */
export function useRouteHandlers({ stageRef, snapEnabled, snapSizePx, width, height }) {
  const {
    canvasMode,
    activeRouteTool,
    units,
    walkwayNodes,
    walkwayLinks,
    addWalkwayNode,
    addProductNode,
    addWalkwayLink,
    linkNodeOntoLink,
    pendingLinkNodeId, // cleared by selectRouteTool whenever the tool changes
    setPendingLinkNodeId,
    editingProductNode,
    editProductNode,
  } = useEditor();
  // The selected tool is remembered across modes, but only acts in route mode
  const isRouteMode = canvasMode === CANVAS_MODES.ROUTE;
  const isPlacingWalkwayNode = isRouteMode && activeRouteTool === ROUTE_TOOLS.WALKWAY_NODE;
  const isPlacingProductNode = isRouteMode && activeRouteTool === ROUTE_TOOLS.PRODUCT_NODE;
  const isLinking = isRouteMode && activeRouteTool === ROUTE_TOOLS.LINK;
  // With no tool active, clicking a product node reopens its storage location picker
  const isSelecting = isRouteMode && !activeRouteTool;

  // Pointer-driven previews - cleared on mouse leave, which always happens before a tool change
  const [previewNode, setPreviewNode] = useState(null); // { x, y, type, ... } in metres
  const [linkPreviewEnd, setLinkPreviewEnd] = useState(null); // metres
  // What a click would act on: { nodeId } or { linkId, x, y } (metres), or null
  const [hoveredTarget, setHoveredTarget] = useState(null);

  const pendingNode = walkwayNodes.find((node) => node.id === pendingLinkNodeId);
  const isPendingProduct = isProductNode(pendingNode);

  // Nodes that cannot be picked as the second node: ones already linked to the pending node,
  // and - when a product node is pending - every other product node
  const unavailableNodeIds = new Set();
  if (pendingLinkNodeId) {
    getLinkedNodeIds(walkwayLinks, pendingLinkNodeId).forEach((id) => unavailableNodeIds.add(id));
    if (isPendingProduct) {
      walkwayNodes
        .filter((node) => isProductNode(node) && node.id !== pendingLinkNodeId)
        .forEach((node) => unavailableNodeIds.add(node.id));
    }
  }

  const cancelPendingLink = useCallback(() => {
    setPendingLinkNodeId(null);
    setLinkPreviewEnd(null);
  }, [setPendingLinkNodeId]);

  // Escape cancels an in-progress link
  useEffect(() => {
    if (!pendingLinkNodeId) return;
    function onKeyDown(e) {
      if (e.key === "Escape") cancelPendingLink();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingLinkNodeId, cancelPendingLink]);

  // --- HELPERS ---

  function toMetres(point) {
    const px = CANVAS_CONFIG.PIXELS_PER_METER;
    return { x: point.x / px, y: point.y / px };
  }

  /** Returns the id of the walkway node under the pointer, or null. */
  function getNodeIdAtPointer() {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;

    const hit = stage.getIntersection(pointer);
    if (hit?.getLayer()?.name() !== ROUTE_LAYER_NAME) return null;
    return hit.id() || null;
  }

  /**
   * Works out where a walkway node would be placed for the current pointer position.
   * Returns null if the point is off the floor or lands on a unit or existing node.
   *
   * @returns {{ x: number, y: number } | null} Position in metres
   */
  function getWalkwayNodePlacement() {
    const stage = stageRef.current;
    const pointer = stage?.getRelativePointerPosition();
    if (!pointer) return null;

    const x = snapEnabled ? snapToGrid(pointer.x, snapSizePx) : pointer.x;
    const y = snapEnabled ? snapToGrid(pointer.y, snapSizePx) : pointer.y;
    if (x < 0 || y < 0 || x > width || y > height) return null;

    // Only allow placement on the empty floor (background or grid lines)
    const hit = stage.getIntersection(stage.getAbsoluteTransform().point({ x, y }));
    if (hit && hit.getLayer()?.name() !== GRID_LAYER_NAME) return null;

    return { ...toMetres({ x, y }), type: ROUTE_NODE_TYPES.WALKWAY };
  }

  /** Converts a distance in on-screen pixels to metres at the current zoom. */
  function screenPxToMetres(screenPx) {
    const scale = stageRef.current?.scaleX() || 1;
    return screenPx / (scale * CANVAS_CONFIG.PIXELS_PER_METER);
  }

  /**
   * Works out where a product node would be placed for the current pointer position:
   * the nearest point on the side of a saved storage unit, if one is close enough.
   * Returns null if no unit side is nearby, the only nearby sides run along the floor
   * boundary, or the spot is already taken by a node.
   *
   * @returns {{ x: number, y: number, storageUnitId: string } | null} Position in metres
   */
  function getProductNodePlacement() {
    const pointer = stageRef.current?.getRelativePointerPosition();
    if (!pointer) return null;

    // Product nodes must sit inside the floor, never on its boundary (a wall), so unit sides
    // are only snapped to where they are at least a node's radius in from the floor edge
    const margin = screenPxToMetres(CANVAS_CONFIG.WALKWAY_NODE_RADIUS_PX);
    const floor = toMetres({ x: width, y: height });
    const insideFloor = {
      minX: margin,
      minY: margin,
      maxX: floor.x - margin,
      maxY: floor.y - margin,
    };

    // Units without an _id have not been saved yet, so a node cannot reference them
    const savedUnits = units.filter((unit) => unit._id);
    const edgePoint = findNearestUnitEdgePoint(
      toMetres(pointer),
      savedUnits,
      screenPxToMetres(CANVAS_CONFIG.PRODUCT_NODE_SNAP_DISTANCE_PX),
      insideFloor,
    );
    if (!edgePoint) return null;

    const minGap = screenPxToMetres(CANVAS_CONFIG.WALKWAY_NODE_RADIUS_PX * 2);
    const overlapsNode = walkwayNodes.some(
      (node) => Math.hypot(node.x - edgePoint.x, node.y - edgePoint.y) < minGap,
    );
    if (overlapsNode) return null;

    return {
      x: edgePoint.x,
      y: edgePoint.y,
      type: ROUTE_NODE_TYPES.PRODUCT,
      storageUnitId: edgePoint.unit._id,
    };
  }

  /**
   * Finds the walkway link nearest the pointer, for linking a product node onto it.
   * If the nearest point is right next to one of the link's end nodes, that node is
   * targeted instead, so junctions are never stacked on top of existing nodes.
   *
   * @returns {{ nodeId: string } | { linkId: string, x: number, y: number } | null}
   */
  function findWalkwayLinkTarget() {
    const pointer = stageRef.current?.getRelativePointerPosition();
    if (!pointer) return null;

    const point = toMetres(pointer);
    const nodesById = new Map(walkwayNodes.map((node) => [node.id, node]));
    let best = null;
    let bestDistance = screenPxToMetres(CANVAS_CONFIG.LINK_TARGET_DISTANCE_PX);

    for (const link of walkwayLinks) {
      const from = nodesById.get(link.fromId);
      const to = nodesById.get(link.toId);
      // Product links are not part of the walkway, so they cannot be joined onto
      if (!from || !to || isProductNode(from) || isProductNode(to)) continue;

      const onLink = closestPointOnSegment(point, from, to);
      const distance = Math.hypot(onLink.x - point.x, onLink.y - point.y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { link, from, to, onLink };
      }
    }
    if (!best) return null;

    const minGap = screenPxToMetres(CANVAS_CONFIG.WALKWAY_NODE_RADIUS_PX * 2);
    for (const end of [best.from, best.to]) {
      if (Math.hypot(end.x - best.onLink.x, end.y - best.onLink.y) < minGap) {
        return { nodeId: end.id };
      }
    }
    return { linkId: best.link.id, x: best.onLink.x, y: best.onLink.y };
  }

  /**
   * Works out what a link tool click would act on: a node under the pointer, or - when a
   * product node is pending - a point on a nearby walkway link.
   */
  function getLinkTarget() {
    const nodeId = getNodeIdAtPointer();
    if (nodeId) return { nodeId };
    return isPendingProduct ? findWalkwayLinkTarget() : null;
  }

  /** Whether clicking the given link target would do something. */
  function isValidLinkTarget(target) {
    if (!target) return false;
    if (target.linkId) return true; // only offered when a product node is pending
    if (!pendingLinkNodeId || target.nodeId === pendingLinkNodeId) return true; // pick / cancel
    return canLinkNodes(walkwayNodes, walkwayLinks, pendingLinkNodeId, target.nodeId);
  }

  /** Returns the product node under the pointer, or null. */
  function getProductNodeAtPointer() {
    const nodeId = getNodeIdAtPointer();
    const node = walkwayNodes.find((n) => n.id === nodeId);
    return isProductNode(node) ? node : null;
  }

  // --- HANDLERS ---

  function handleRouteMouseMove() {
    if (isSelecting) {
      const node = getProductNodeAtPointer();
      setHoveredTarget(node ? { nodeId: node.id } : null);
    } else if (isPlacingWalkwayNode) {
      setPreviewNode(getWalkwayNodePlacement());
    } else if (isPlacingProductNode) {
      setPreviewNode(getProductNodePlacement());
    } else if (isLinking) {
      const target = getLinkTarget();
      setHoveredTarget(target);
      if (pendingLinkNodeId) {
        // Snap the preview line onto a targeted link, otherwise follow the pointer
        const pointer = stageRef.current?.getRelativePointerPosition();
        setLinkPreviewEnd(target?.linkId ? target : pointer ? toMetres(pointer) : null);
      }
    }
  }

  function handleRouteMouseLeave() {
    setPreviewNode(null);
    setHoveredTarget(null);
    setLinkPreviewEnd(null);
  }

  function handleRouteClick() {
    if (isSelecting) {
      const node = getProductNodeAtPointer();
      if (node) editProductNode(node.id);
      return;
    }

    if (isPlacingWalkwayNode) {
      const placement = getWalkwayNodePlacement();
      if (!placement) return;
      addWalkwayNode(placement);
      setPreviewNode(null); // the new node now occupies this spot
      return;
    }

    if (isPlacingProductNode) {
      const placement = getProductNodePlacement();
      if (!placement) return;
      addProductNode(placement);
      setPreviewNode(null);
      return;
    }

    if (isLinking) {
      const target = getLinkTarget();
      if (!isValidLinkTarget(target)) return; // ignore clicks on nothing, or on invalid nodes

      if (target.linkId) {
        linkNodeOntoLink(pendingLinkNodeId, target.linkId, target);
        setHoveredTarget(null);
        cancelPendingLink();
      } else if (!pendingLinkNodeId) {
        setPendingLinkNodeId(target.nodeId);
      } else if (target.nodeId === pendingLinkNodeId) {
        cancelPendingLink();
      } else {
        addWalkwayLink(pendingLinkNodeId, target.nodeId);
        cancelPendingLink();
      }
    }
  }

  // --- CURSOR ---

  const isPlacingNode = isPlacingWalkwayNode || isPlacingProductNode;

  let cursor;
  if (isPlacingNode) {
    cursor = "crosshair";
  } else if (isLinking && hoveredTarget) {
    cursor = isValidLinkTarget(hoveredTarget) ? "pointer" : "not-allowed";
  } else if (isSelecting && hoveredTarget) {
    cursor = "pointer";
  }

  // A link target means a junction would be created there - show where
  const junctionPreview =
    isLinking && pendingLinkNodeId && hoveredTarget?.linkId ? hoveredTarget : null;

  return {
    // In route mode every canvas click goes to the route handlers
    handlesClicks: isRouteMode,
    cursor,
    previewNode: isPlacingNode ? previewNode : null,
    pendingLinkNodeId,
    // Highlight the product node whose storage locations are being chosen
    selectedNodeId: isRouteMode ? (editingProductNode?.nodeId ?? null) : null,
    unavailableNodeIds,
    linkPreviewEnd: pendingLinkNodeId ? linkPreviewEnd : null,
    junctionPreview,
    handleRouteMouseMove,
    handleRouteMouseLeave,
    handleRouteClick,
  };
}
