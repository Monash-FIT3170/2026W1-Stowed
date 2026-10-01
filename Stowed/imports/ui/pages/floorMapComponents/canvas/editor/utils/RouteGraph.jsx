/**
 * Helpers for the walkway route graph. Links are undirected, so A-B and B-A are the same link.
 *
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
