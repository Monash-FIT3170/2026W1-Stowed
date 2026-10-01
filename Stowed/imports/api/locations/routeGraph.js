// imports/api/locations/routeGraph.js

/**
 * Helpers for the walkway route graph, shared by the floor map editor (client)
 * and the route save method (server). Links are undirected, so A-B and B-A are the same link.
 *
 * @typedef {{ id: string, x: number, y: number }} WalkwayNode - Position in metres
 * @typedef {{ id: string, fromId: string, toId: string }} WalkwayLink
 */

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
 * - links with unique ids that join two different existing nodes
 * - no duplicate links (in either direction)
 *
 * @param {WalkwayNode[]} nodes
 * @param {WalkwayLink[]} links
 *
 * @returns {string | null} Description of the problem, or null if valid
 */
export function validateRouteGraph(nodes, links) {
  const nodeIds = new Set();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) return `Duplicate node id "${node.id}".`;
    nodeIds.add(node.id);

    const hasValidPosition =
      Number.isFinite(node.x) && Number.isFinite(node.y) && node.x >= 0 && node.y >= 0;
    if (!hasValidPosition) return `Node "${node.id}" has an invalid position.`;
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
    checkedLinks.push(link);
  }

  return null;
}
