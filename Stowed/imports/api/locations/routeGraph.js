// imports/api/locations/routeGraph.js

/**
 * Helpers for the walkway route graph, shared by the floor map editor (client)
 * and the route save method (server). Links are undirected, so A-B and B-A are the same link.
 *
 * @typedef {{ id: string, x: number, y: number, type?: string, storageUnitId?: string, storageLocationIds?: string[] }} WalkwayNode
 *   Position in metres. `type` is one of ROUTE_NODE_TYPES (missing means walkway);
 *   product nodes sit on the edge of the storage unit given by `storageUnitId`, and
 *   `storageLocationIds` lists the locations in that unit that can be reached from the node.
 * @typedef {{ id: string, fromId: string, toId: string }} WalkwayLink
 */

/** Distance (metres) from the floor edge within which a point counts as on the boundary. */
const BOUNDARY_TOLERANCE_M = 1e-6;

/** Kinds of node in the route graph. */
export const ROUTE_NODE_TYPES = {
  WALKWAY: "walkway", // a point on a walkway
  PRODUCT: "product", // a pick point on the side of a storage unit
};

/**
 * Returns a node's type, treating nodes saved before types existed as walkway nodes.
 *
 * @param {WalkwayNode} node
 * @returns {string}
 */
export function getNodeType(node) {
  return node.type ?? ROUTE_NODE_TYPES.WALKWAY;
}

/**
 * @param {WalkwayNode | undefined} node
 * @returns {boolean}
 */
export function isProductNode(node) {
  return Boolean(node) && getNodeType(node) === ROUTE_NODE_TYPES.PRODUCT;
}

/**
 * Returns true if the two nodes are already linked (in either direction).
 *
 * @param {WalkwayLink[]} links
 * @param {string}        nodeIdA
 * @param {string}        nodeIdB
 *
 * @returns {boolean}
 */
export function hasLink(links, nodeIdA, nodeIdB) {
  return links.some(
    (link) =>
      (link.fromId === nodeIdA && link.toId === nodeIdB) ||
      (link.fromId === nodeIdB && link.toId === nodeIdA),
  );
}

/**
 * Returns true if a new link between the two nodes is allowed: they must be
 * two different nodes that are not already linked.
 *
 * @param {WalkwayLink[]} links
 * @param {string}        nodeIdA
 * @param {string}        nodeIdB
 *
 * @returns {boolean}
 */
export function canLink(links, nodeIdA, nodeIdB) {
  return Boolean(nodeIdA && nodeIdB) && nodeIdA !== nodeIdB && !hasLink(links, nodeIdA, nodeIdB);
}

/**
 * Like canLink, but also applies the node type rules: product nodes connect to the
 * walkway, so two product nodes cannot be linked directly.
 *
 * @param {WalkwayNode[]} nodes
 * @param {WalkwayLink[]} links
 * @param {string}        nodeIdA
 * @param {string}        nodeIdB
 *
 * @returns {boolean}
 */
export function canLinkNodes(nodes, links, nodeIdA, nodeIdB) {
  if (!canLink(links, nodeIdA, nodeIdB)) return false;
  const nodeA = nodes.find((node) => node.id === nodeIdA);
  const nodeB = nodes.find((node) => node.id === nodeIdB);
  return !(isProductNode(nodeA) && isProductNode(nodeB));
}

/**
 * Returns true if the link connects a product node to the walkway.
 *
 * @param {Map<string, WalkwayNode>} nodesById
 * @param {WalkwayLink}              link
 *
 * @returns {boolean}
 */
export function isProductLink(nodesById, link) {
  return isProductNode(nodesById.get(link.fromId)) || isProductNode(nodesById.get(link.toId));
}

/**
 * Returns the ids of walkway nodes where a product node joins the walkway
 * (walkway nodes directly linked to at least one product node).
 *
 * @param {WalkwayNode[]} nodes
 * @param {WalkwayLink[]} links
 *
 * @returns {Set<string>}
 */
export function getProductAccessNodeIds(nodes, links) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const accessIds = new Set();
  for (const link of links) {
    const from = nodesById.get(link.fromId);
    const to = nodesById.get(link.toId);
    if (isProductNode(from) && to && !isProductNode(to)) accessIds.add(to.id);
    if (isProductNode(to) && from && !isProductNode(from)) accessIds.add(from.id);
  }
  return accessIds;
}

/**
 * Splits a link in two by inserting a new walkway node at `point`, which should lie on the link.
 * The original link A-B is replaced by A-J and J-B, where J is the new node.
 *
 * @param {WalkwayNode[]} nodes
 * @param {WalkwayLink[]} links
 * @param {string}        linkId - The link to split
 * @param {{ x: number, y: number }} point - Where to insert the new node (metres)
 * @param {{ nodeId: string, linkIdA: string, linkIdB: string }} newIds - Ids for the new node and links
 *
 * @returns {{ nodes: WalkwayNode[], links: WalkwayLink[] } | null} The new graph, or null if the link does not exist
 */
export function splitLink(nodes, links, linkId, point, newIds) {
  const link = links.find((l) => l.id === linkId);
  if (!link) return null;

  const junction = { id: newIds.nodeId, x: point.x, y: point.y, type: ROUTE_NODE_TYPES.WALKWAY };
  return {
    nodes: [...nodes, junction],
    links: [
      ...links.filter((l) => l.id !== linkId),
      { id: newIds.linkIdA, fromId: link.fromId, toId: junction.id },
      { id: newIds.linkIdB, fromId: junction.id, toId: link.toId },
    ],
  };
}

/**
 * Returns the ids of every node that has at least one link.
 *
 * @param {WalkwayLink[]} links
 *
 * @returns {Set<string>}
 */
export function getConnectedNodeIds(links) {
  const connected = new Set();
  for (const link of links) {
    connected.add(link.fromId);
    connected.add(link.toId);
  }
  return connected;
}

/**
 * Returns the ids of every node directly linked to the given node.
 *
 * @param {WalkwayLink[]} links
 * @param {string}        nodeId
 *
 * @returns {Set<string>}
 */
export function getLinkedNodeIds(links, nodeId) {
  const linked = new Set();
  for (const link of links) {
    if (link.fromId === nodeId) linked.add(link.toId);
    if (link.toId === nodeId) linked.add(link.fromId);
  }
  return linked;
}

/**
 * Checks a complete route graph before it is saved. Returns the first problem found,
 * or null if the graph is valid. A valid graph has:
 * - nodes with unique ids and finite, non-negative coordinates
 * - a known node type; product nodes (and only product nodes) have a storageUnitId,
 *   and may list the storage locations they give access to (no repeats)
 * - links with unique ids that join two different existing nodes
 * - no duplicate links (in either direction) and no links between two product nodes
 *
 * - when the floor size is known: every node on the floor, and product nodes strictly inside
 *   it - never on the floor's boundary, where they could not be reached
 *
 * @param {WalkwayNode[]} nodes
 * @param {WalkwayLink[]} links
 * @param {{ width: number, height: number } | null} [floorSize] - Floor size in metres
 *
 * @returns {string | null} Description of the problem, or null if valid
 */
export function validateRouteGraph(nodes, links, floorSize = null) {
  const nodeIds = new Set();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) return `Duplicate node id "${node.id}".`;
    nodeIds.add(node.id);

    const hasValidPosition =
      Number.isFinite(node.x) && Number.isFinite(node.y) && node.x >= 0 && node.y >= 0;
    if (!hasValidPosition) return `Node "${node.id}" has an invalid position.`;

    const type = getNodeType(node);
    if (!Object.values(ROUTE_NODE_TYPES).includes(type)) {
      return `Node "${node.id}" has an unknown type.`;
    }
    const isProduct = type === ROUTE_NODE_TYPES.PRODUCT;

    if (floorSize) {
      if (node.x > floorSize.width || node.y > floorSize.height) {
        return `Node "${node.id}" is outside the floor.`;
      }
      // Tolerance absorbs floating point error from snapping onto unit sides
      const isOnBoundary =
        node.x <= BOUNDARY_TOLERANCE_M ||
        node.y <= BOUNDARY_TOLERANCE_M ||
        node.x >= floorSize.width - BOUNDARY_TOLERANCE_M ||
        node.y >= floorSize.height - BOUNDARY_TOLERANCE_M;
      if (isProduct && isOnBoundary) {
        return `Product node "${node.id}" is on the floor boundary.`;
      }
    }
    if (isProduct !== Boolean(node.storageUnitId)) {
      return isProduct
        ? `Product node "${node.id}" is not attached to a storage unit.`
        : `Walkway node "${node.id}" cannot be attached to a storage unit.`;
    }
    if (!isProduct && node.storageLocationIds !== undefined) {
      return `Walkway node "${node.id}" cannot give access to storage locations.`;
    }
    const locationIds = node.storageLocationIds ?? [];
    if (new Set(locationIds).size !== locationIds.length) {
      return `Product node "${node.id}" lists the same storage location twice.`;
    }
  }

  const linkIds = new Set();
  const checkedLinks = [];
  for (const link of links) {
    if (linkIds.has(link.id)) return `Duplicate link id "${link.id}".`;
    linkIds.add(link.id);

    if (!nodeIds.has(link.fromId) || !nodeIds.has(link.toId)) {
      return `Link "${link.id}" refers to a node that does not exist.`;
    }
    if (!canLink(checkedLinks, link.fromId, link.toId)) {
      return `Link "${link.id}" is a duplicate or joins a node to itself.`;
    }
    if (!canLinkNodes(nodes, checkedLinks, link.fromId, link.toId)) {
      return `Link "${link.id}" joins two product nodes.`;
    }
    checkedLinks.push(link);
  }

  return null;
}

/**
 * Removes the nodes that match `shouldRemove`, along with every link touching them.
 *
 * @param {WalkwayNode[]} nodes
 * @param {WalkwayLink[]} links
 * @param {(node: WalkwayNode) => boolean} shouldRemove
 *
 * @returns {{ nodes: WalkwayNode[], links: WalkwayLink[] }}
 */
export function removeNodes(nodes, links, shouldRemove) {
  const removedIds = new Set(nodes.filter(shouldRemove).map((node) => node.id));
  return {
    nodes: nodes.filter((node) => !removedIds.has(node.id)),
    links: links.filter((link) => !removedIds.has(link.fromId) && !removedIds.has(link.toId)),
  };
}
