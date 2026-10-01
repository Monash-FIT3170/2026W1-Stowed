import { Layer, Circle, Line } from "react-konva";
import { COLOURS } from "../../../FloorMapStyles";
import { CANVAS_CONFIG } from "../../CanvasConfig";
import { getConnectedNodeIds } from "/imports/api/locations/routeGraph";

export const ROUTE_LAYER_NAME = "route";

/**
 * Renders the walkway route graph: links, walkway nodes, and tool previews.
 * Nodes and lines keep a constant on-screen size regardless of zoom.
 * Each node circle carries its node id as its Konva `id`, so clicks can identify it.
 *
 * @param {{ id: string, x: number, y: number }[]}        nodes              - Positions in metres
 * @param {{ id: string, fromId: string, toId: string }[]} links
 * @param {{ x: number, y: number } | null}                previewNode        - Next node placement (metres)
 * @param {string | null}                                  pendingLinkNodeId  - First node picked by the link tool
 * @param {Set<string>}                                    unavailableNodeIds - Nodes that cannot be linked to the pending node
 * @param {{ x: number, y: number } | null}                linkPreviewEnd     - Pointer position for the in-progress link (metres)
 * @param {number}                                         scale              - Current stage zoom
 *
 * @returns {JSX.Element}
 */
export function RouteLayer({
  nodes,
  links,
  previewNode,
  pendingLinkNodeId,
  unavailableNodeIds,
  linkPreviewEnd,
  scale,
}) {
  const px = CANVAS_CONFIG.PIXELS_PER_METER;
  const radius = CANVAS_CONFIG.WALKWAY_NODE_RADIUS_PX / scale;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const pendingNode = pendingLinkNodeId ? nodesById.get(pendingLinkNodeId) : null;
  const connectedNodeIds = getConnectedNodeIds(links);

  // New nodes are red; a node turns green once picked by the link tool or linked to another
  const nodeProps = {
    radius,
    fill: COLOURS.WALKWAY_NODE_UNLINKED,
    stroke: COLOURS.WALKWAY_NODE_STROKE,
    strokeWidth: 2,
    strokeScaleEnabled: false,
    // Soft shadow lifts the node off both the floor and dimmed units
    shadowColor: "black",
    shadowBlur: 4,
    shadowOpacity: 0.35,
    shadowForStrokeEnabled: false,
  };

  const linkProps = {
    stroke: COLOURS.WALKWAY_LINK,
    strokeWidth: CANVAS_CONFIG.WALKWAY_LINK_WIDTH_PX,
    strokeScaleEnabled: false,
    lineCap: "round",
    listening: false, // links never block clicks on nodes or the floor
  };

  return (
    <Layer name={ROUTE_LAYER_NAME}>
      {/* LINKS - drawn first so nodes sit on top */}
      {links.map((link) => {
        const from = nodesById.get(link.fromId);
        const to = nodesById.get(link.toId);
        if (!from || !to) return null;
        return (
          <Line
            key={link.id}
            points={[from.x * px, from.y * px, to.x * px, to.y * px]}
            {...linkProps}
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
          {...linkProps}
          dash={[6, 6]}
          opacity={0.6}
        />
      )}

      {/* NODES */}
      {nodes.map((node) => {
        const isPending = node.id === pendingLinkNodeId;
        const isGreen = isPending || connectedNodeIds.has(node.id);
        return (
          <Circle
            key={node.id}
            id={node.id}
            x={node.x * px}
            y={node.y * px}
            {...nodeProps}
            fill={isGreen ? COLOURS.WALKWAY_NODE_LINKED : COLOURS.WALKWAY_NODE_UNLINKED}
            radius={isPending ? radius * 1.4 : radius}
            stroke={isPending ? COLOURS.WALKWAY_NODE_SELECTED_STROKE : nodeProps.stroke}
            strokeWidth={isPending ? 3 : nodeProps.strokeWidth}
            opacity={unavailableNodeIds?.has(node.id) ? 0.35 : 1}
          />
        );
      })}

      {/* NEXT NODE PREVIEW */}
      {previewNode && (
        <Circle
          x={previewNode.x * px}
          y={previewNode.y * px}
          {...nodeProps}
          opacity={0.4}
          listening={false}
        />
      )}
    </Layer>
  );
}
