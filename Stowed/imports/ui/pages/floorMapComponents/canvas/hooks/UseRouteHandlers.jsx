import { useCallback, useEffect, useState } from "react";
import { useEditor, CANVAS_MODES, ROUTE_TOOLS } from "../editor/EditorContext";
import { snapToGrid } from "../editor/utils/Snapping";
import { canLink, getLinkedNodeIds } from "/imports/api/locations/routeGraph";
import { CANVAS_CONFIG } from "../CanvasConfig";
import { GRID_LAYER_NAME } from "../components/layers/GridLayer";
import { ROUTE_LAYER_NAME } from "../components/layers/RouteLayer";

/**
 * Custom hook that provides the canvas event handlers and preview state for route mode tools.
 *
 * - Walkway node tool: click empty floor to place a node (snapped to the grid if enabled).
 * - Link tool: click one node, then another, to link them. Clicks anywhere other than a node
 *   are ignored. Clicking the first node again, or pressing Escape, cancels.
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
    walkwayLinks,
    addWalkwayNode,
    addWalkwayLink,
    pendingLinkNodeId, // cleared by selectRouteTool whenever the tool changes
    setPendingLinkNodeId,
  } = useEditor();
  // The selected tool is remembered across modes, but only acts in route mode
  const isRouteMode = canvasMode === CANVAS_MODES.ROUTE;
  const isPlacingWalkwayNode = isRouteMode && activeRouteTool === ROUTE_TOOLS.WALKWAY_NODE;
  const isLinking = isRouteMode && activeRouteTool === ROUTE_TOOLS.LINK;

  // Pointer-driven previews - cleared on mouse leave, which always happens before a tool change
  const [previewNode, setPreviewNode] = useState(null); // metres
  const [linkPreviewEnd, setLinkPreviewEnd] = useState(null); // metres
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Nodes the pending node is already linked to - these cannot be picked as the second node
  const unavailableNodeIds = pendingLinkNodeId
    ? getLinkedNodeIds(walkwayLinks, pendingLinkNodeId)
    : new Set();

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

    return toMetres({ x, y });
  }

  // --- HANDLERS ---

  function handleRouteMouseMove() {
    if (isPlacingWalkwayNode) {
      setPreviewNode(getWalkwayNodePlacement());
    } else if (isLinking) {
      setHoveredNodeId(getNodeIdAtPointer());
      if (pendingLinkNodeId) {
        const pointer = stageRef.current?.getRelativePointerPosition();
        setLinkPreviewEnd(pointer ? toMetres(pointer) : null);
      }
    }
  }

  function handleRouteMouseLeave() {
    setPreviewNode(null);
    setHoveredNodeId(null);
    setLinkPreviewEnd(null);
  }

  function handleRouteClick() {
    if (isPlacingWalkwayNode) {
      const placement = getWalkwayNodePlacement();
      if (!placement) return;
      addWalkwayNode(placement);
      setPreviewNode(null); // the new node now occupies this spot
      return;
    }

    if (isLinking) {
      const nodeId = getNodeIdAtPointer();
      if (!nodeId) return; // only nodes can be selected

      if (!pendingLinkNodeId) {
        setPendingLinkNodeId(nodeId);
      } else if (nodeId === pendingLinkNodeId) {
        cancelPendingLink();
      } else if (canLink(walkwayLinks, pendingLinkNodeId, nodeId)) {
        addWalkwayLink(pendingLinkNodeId, nodeId);
        cancelPendingLink();
      }
      // Otherwise the nodes are already linked - ignore the click and keep the first node picked
    }
  }

  // --- CURSOR ---

  let cursor;
  if (isPlacingWalkwayNode) {
    cursor = "crosshair";
  } else if (isLinking && hoveredNodeId) {
    const isValidTarget =
      !pendingLinkNodeId ||
      hoveredNodeId === pendingLinkNodeId ||
      canLink(walkwayLinks, pendingLinkNodeId, hoveredNodeId);
    cursor = isValidTarget ? "pointer" : "not-allowed";
  }

  return {
    isRouteToolActive: isPlacingWalkwayNode || isLinking,
    cursor,
    previewNode: isPlacingWalkwayNode ? previewNode : null,
    pendingLinkNodeId,
    unavailableNodeIds,
    linkPreviewEnd: pendingLinkNodeId ? linkPreviewEnd : null,
    handleRouteMouseMove,
    handleRouteMouseLeave,
    handleRouteClick,
  };
}
