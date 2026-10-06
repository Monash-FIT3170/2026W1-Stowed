import { Layer, Circle, Line, Rect } from "react-konva";
import { COLOURS } from "../../../FloorMapStyles";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import {
  getConnectedNodeIds,
  getNodeType,
  getProductAccessNodeIds,
  isProductLink,
  isProductNode,
  ROUTE_NODE_TYPES,
} from "/imports/api/locations/routeGraph";

export const ROUTE_LAYER_NAME = "route";

/**
 * Fill colour for a node:
 * - product nodes are always blue
 * - walkway nodes where a product node joins the walkway are purple
 * - other walkway nodes are red until picked by the link tool or linked, then green
 *
 * @param {{ type?: string }} node
 * @param {{ isLinkedOrPicked?: boolean, isProductAccess?: boolean }} state
 * @returns {string}
 */
function getNodeFill(node, { isLinkedOrPicked = false, isProductAccess = false } = {}) {
  if (getNodeType(node) === ROUTE_NODE_TYPES.PRODUCT) return COLOURS.PRODUCT_NODE;
  if (isProductAccess) return COLOURS.PRODUCT_ACCESS_NODE;
  return isLinkedOrPicked ? COLOURS.WALKWAY_NODE_LINKED : COLOURS.WALKWAY_NODE_UNLINKED;
}

/**
 * A single route node: a circle for walkway nodes, a square for product nodes.
 * Any extra props (id, fill, stroke, opacity, listening, ...) are passed to the Konva shape.
 *
 * @param {{ x: number, y: number, type?: string }} node - Position in metres
 * @param {number}                                   size - Radius / half-width in canvas pixels
 */
function RouteNode({ node, size, ...shapeProps }) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  const sharedProps = {
    strokeScaleEnabled: false,
    // Soft shadow lifts the node off both the floor and dimmed units
    shadowColor: "black",
    shadowBlur: 4,
    shadowOpacity: 0.35,
    shadowForStrokeEnabled: false,
    ...shapeProps,
  };

  if (getNodeType(node) === ROUTE_NODE_TYPES.PRODUCT) {
    return (
      <Rect
        x={node.x * px - size}
        y={node.y * px - size}
        width={size * 2}
        height={size * 2}
        cornerRadius={size * 0.3}
        {...sharedProps}
      />
    );
  }
  return <Circle x={node.x * px} y={node.y * px} radius={size} {...sharedProps} />;
}

/**
 * Renders the route graph: links, walkway and product nodes, and tool previews.
 * Nodes and lines keep a constant on-screen size regardless of zoom.
 * Each node shape carries its node id as its Konva `id`, so clicks can identify it.
 *
 * @param {{ id: string, x: number, y: number, type?: string }[]} nodes - Positions in metres
 * @param {{ id: string, fromId: string, toId: string }[]} links
 * @param {{ x: number, y: number } | null}                previewNode        - Next node placement (metres)
 * @param {string | null}                                  pendingLinkNodeId  - First node picked by the link tool
 * @param {string | null}                                  selectedNodeId     - Product node whose storage locations are being edited
 * @param {Set<string>}                                    unavailableNodeIds - Nodes that cannot be linked to the pending node
 * @param {{ x: number, y: number } | null}                linkPreviewEnd     - Pointer position for the in-progress link (metres)
 * @param {{ x: number, y: number } | null}                junctionPreview    - Where a link would be split for a product node (metres)
 * @param {{ nodeId?: string, linkId?: string } | null}    deleteTarget       - What the delete tool would remove if clicked
 * @param {number}                                         scale              - Current stage zoom
 *
 * @returns {JSX.Element}
 */
export function RouteLayer({
  nodes,
  links,
  previewNode,
  pendingLinkNodeId,
  selectedNodeId,
  unavailableNodeIds,
  linkPreviewEnd,
  junctionPreview,
  deleteTarget,
  scale,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  const radius = CANVAS_CONFIG.WALKWAY_NODE_RADIUS_PX / scale;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const pendingNode = pendingLinkNodeId ? nodesById.get(pendingLinkNodeId) : null;
  const connectedNodeIds = getConnectedNodeIds(links);
  const productAccessNodeIds = getProductAccessNodeIds(nodes, links);

  // Shown in red: the hovered link, or the hovered node plus every link that would go with it
  const isMarkedForDelete = (link) =>
    link.id === deleteTarget?.linkId ||
    link.fromId === deleteTarget?.nodeId ||
    link.toId === deleteTarget?.nodeId;

  // Links joining a product node to the walkway are blue; walkway links are green
  const linkProps = (isProduct) => ({
    stroke: isProduct ? COLOURS.PRODUCT_LINK : COLOURS.WALKWAY_LINK,
    strokeWidth: CANVAS_CONFIG.WALKWAY_LINK_WIDTH_PX,
    strokeScaleEnabled: false,
    lineCap: "round",
    listening: false, // links never block clicks on nodes or the floor
  });

  return (
    <Layer name={ROUTE_LAYER_NAME}>
      {/* LINKS - drawn first so nodes sit on top */}
      {links.map((link) => {
        const from = nodesById.get(link.fromId);
        const to = nodesById.get(link.toId);
        if (!from || !to) return null;
        const isDeleting = isMarkedForDelete(link);
        return (
          <Line
            key={link.id}
            points={[from.x * px, from.y * px, to.x * px, to.y * px]}
            {...linkProps(isProductLink(nodesById, link))}
            {...(isDeleting && {
              stroke: COLOURS.DELETE_HIGHLIGHT,
              strokeWidth: CANVAS_CONFIG.WALKWAY_LINK_WIDTH_PX * 2,
            })}
          />
        );
      })}

      {/* IN-PROGRESS LINK - follows the pointer from the first picked node */}
      {pendingNode && linkPreviewEnd && (
        <Line
          points={[
            pendingNode.x * px,
            pendingNode.y * px,
            linkPreviewEnd.x * px,
            linkPreviewEnd.y * px,
          ]}
          {...linkProps(isProductNode(pendingNode))}
          dash={[6, 6]}
          opacity={0.6}
        />
      )}

      {/* NODES */}
      {nodes.map((node) => {
        const isPending = node.id === pendingLinkNodeId;
        const isDeleting = node.id === deleteTarget?.nodeId;
        const isHighlighted = isPending || isDeleting || node.id === selectedNodeId;
        return (
          <RouteNode
            key={node.id}
            id={node.id}
            node={node}
            size={isHighlighted ? radius * 1.4 : radius}
            fill={getNodeFill(node, {
              isLinkedOrPicked: isPending || connectedNodeIds.has(node.id),
              isProductAccess: productAccessNodeIds.has(node.id),
            })}
            stroke={
              isDeleting
                ? COLOURS.DELETE_HIGHLIGHT
                : isHighlighted
                  ? COLOURS.WALKWAY_NODE_SELECTED_STROKE
                  : COLOURS.WALKWAY_NODE_STROKE
            }
            strokeWidth={isHighlighted ? 3 : 2}
            opacity={unavailableNodeIds?.has(node.id) ? 0.35 : 1}
          />
        );
      })}

      {/* NEXT NODE PREVIEW */}
      {previewNode && (
        <RouteNode
          node={previewNode}
          size={radius}
          fill={getNodeFill(previewNode)}
          stroke={COLOURS.WALKWAY_NODE_STROKE}
          strokeWidth={2}
          opacity={0.4}
          listening={false}
        />
      )}

      {/* JUNCTION PREVIEW - where a walkway link would be split to join a product node */}
      {junctionPreview && (
        <RouteNode
          node={junctionPreview}
          size={radius}
          fill={getNodeFill(junctionPreview, { isProductAccess: true })}
          stroke={COLOURS.WALKWAY_NODE_STROKE}
          strokeWidth={2}
          opacity={0.6}
          listening={false}
        />
      )}
    </Layer>
  );
}
