/**
 * Plans a picking route over a saved walkway graph using the greedy multi-endpoint
 * Dijkstra in ./dijkstra.js: from the current position, walk to the nearest product
 * node that still has something to pick up, pick everything available there, repeat.
 */

import { WeightedGraph } from "./dijkstra";
import { isProductNode } from "/imports/api/locations/routeGraph";

/**
 * Finds the closest point to `point` on the segment a-b.
 *
 * @param {{x: number, y: number}} point
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {{x: number, y: number, distance: number}} the closest point and its distance from `point`
 */
export function closestPointOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  // a and b are the same point, so the segment is just that point
  const t =
    lengthSq === 0
      ? 0
      : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { x, y, distance: Math.hypot(point.x - x, point.y - y) };
}

/**
 * Adds the starting point to the graph, joined to the nearest walkway. The start is
 * dropped onto the closest walkway link (an "entry" vertex joined to both ends of that
 * link); if there are no walkway links it is joined straight to the nearest walkway node.
 * Product links are skipped so the route never enters the walkway through a shelf.
 *
 * @param {WeightedGraph} graph a graph built with `WeightedGraph.fromRoute()`
 * @param {{links: Object[]}} route the saved route the graph was built from
 * @param {{x: number, y: number}} start the starting point, in metres
 * @returns {number | null} index of the start vertex, or null if there is no walkway to join
 */
function addStartVertex(graph, route, start) {
  let best = null;
  for (const link of route.links) {
    const from = graph.indexOf(link.fromId);
    const to = graph.indexOf(link.toId);
    if (isProductNode(graph.routeNodes[from]) || isProductNode(graph.routeNodes[to])) continue;
    const closest = closestPointOnSegment(start, graph.coordMap[from], graph.coordMap[to]);
    if (!best || closest.distance < best.closest.distance) best = { closest, from, to };
  }

  const startIndex = graph.adjacencyList.length;
  graph.addVertex(startIndex, { x: start.x, y: start.y });

  if (best) {
    const entry = { x: best.closest.x, y: best.closest.y };
    const entryIndex = graph.adjacencyList.length;
    graph.addVertex(entryIndex, entry);
    graph.addEdge(startIndex, entryIndex, best.closest.distance);
    for (const end of [best.from, best.to]) {
      const endCoord = graph.coordMap[end];
      graph.addEdge(entryIndex, end, Math.hypot(entry.x - endCoord.x, entry.y - endCoord.y));
    }
    return startIndex;
  }

  // No walkway links: fall back to the nearest walkway node
  let nearest = null;
  graph.routeNodes.forEach((node, index) => {
    if (isProductNode(node)) return;
    const distance = Math.hypot(start.x - node.x, start.y - node.y);
    if (!nearest || distance < nearest.distance) nearest = { index, distance };
  });
  if (!nearest) return null;
  graph.addEdge(startIndex, nearest.index, nearest.distance);
  return startIndex;
}

/**
 * Plans a route from `start` that visits a product node for every requested product.
 *
 * @param {{nodes: Object[], links: Object[]}} route the saved walkway graph (FloorMapRoute)
 * @param {{x: number, y: number}} start the starting point, in metres
 * @param {Map<string, string[]>} locationIdsByProduct for each product to pick, the storage
 *   locations on this floor map that hold it
 * @returns {{
 *   path: {x: number, y: number}[],
 *   stops: {nodeId: string, x: number, y: number, productIds: string[]}[],
 *   distance: number,
 *   unreachableProductIds: string[],
 * }} the points to walk through (starting at `start`), the product nodes to stop at in
 *   order, the total walking distance in metres, and the products that could not be reached
 */
export function planRoute(route, start, locationIdsByProduct) {
  const graph = WeightedGraph.fromRoute(route);

  // Product node indices each product can be picked from
  const targetsByProduct = new Map();
  const unreachableProductIds = [];
  for (const [productId, locationIds] of locationIdsByProduct) {
    const targets = new Set(locationIds.flatMap((locationId) => graph.productNodesFor(locationId)));
    if (targets.size > 0) targetsByProduct.set(productId, targets);
    else unreachableProductIds.push(productId);
  }

  const startIndex = targetsByProduct.size > 0 ? addStartVertex(graph, route, start) : null;
  if (startIndex === null) {
    return {
      path: [],
      stops: [],
      distance: 0,
      unreachableProductIds: [...unreachableProductIds, ...targetsByProduct.keys()],
    };
  }

  const pathIndices = [startIndex];
  const stops = [];
  let distance = 0;
  let current = startIndex;
  while (targetsByProduct.size > 0) {
    const finish = [...new Set([...targetsByProduct.values()].flatMap((targets) => [...targets]))];
    let leg;
    try {
      leg = graph.dijkstra(current, finish);
    } catch {
      // None of the remaining products' nodes are connected to where we are
      break;
    }
    pathIndices.push(...leg.waypoints.slice(1));
    distance += leg.legDist;
    current = leg.waypoints[leg.waypoints.length - 1];

    // Pick up every remaining product available at this node
    const productIds = [];
    for (const [productId, targets] of targetsByProduct) {
      if (targets.has(current)) productIds.push(productId);
    }
    productIds.forEach((productId) => targetsByProduct.delete(productId));
    const node = graph.routeNodes[current];
    stops.push({ nodeId: node.id, x: node.x, y: node.y, productIds });
  }

  return {
    path: pathIndices.map((index) => ({ ...graph.coordMap[index] })),
    stops,
    distance,
    unreachableProductIds: [...unreachableProductIds, ...targetsByProduct.keys()],
  };
}
