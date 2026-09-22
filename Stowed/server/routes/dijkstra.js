/**
 * Greedy Approach:
 * Iteratively find the nearest remaining product to be stocked
 * (not optimal but will keep implementation simple and bug free
 * + stakes are low for sub-optimal path finding).
 * 
 * Why Dijkstra's and not A*?
 * A* requires that we already know our two endpoints
 * However, we want to find a route for multiple waypoints at once without
 * necessarily knowing which order they should be in
 * Dijkstra's therefore allows us to find the nearest location of any matching
 * product. 
 */

// code below copied from: https://gist.github.com/Prottoy2938/66849e04b0bac459606059f5f9f3aa1a

//helper class for PriorityQueue
class Node {
  constructor(val, priority) {
    this.val = val;
    this.priority = priority;
  }
}

class PriorityQueue {
  constructor() {
    this.values = [];
  }
  enqueue(val, priority) {
    let newNode = new Node(val, priority);
    this.values.push(newNode);
    this.bubbleUp();
  }
  bubbleUp() {
    let idx = this.values.length - 1;
    const element = this.values[idx];
    while (idx > 0) {
      let parentIdx = Math.floor((idx - 1) / 2);
      let parent = this.values[parentIdx];
      if (element.priority >= parent.priority) break;
      this.values[parentIdx] = element;
      this.values[idx] = parent;
      idx = parentIdx;
    }
  }
  dequeue() {
    const min = this.values[0];
    const end = this.values.pop();
    if (this.values.length > 0) {
      this.values[0] = end;
      this.sinkDown();
    }
    return min;
  }
  sinkDown() {
    let idx = 0;
    const length = this.values.length;
    const element = this.values[0];
    while (true) {
      let leftChildIdx = 2 * idx + 1;
      let rightChildIdx = 2 * idx + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildIdx < length) {
        leftChild = this.values[leftChildIdx];
        if (leftChild.priority < element.priority) {
          swap = leftChildIdx;
        }
      }
      if (rightChildIdx < length) {
        rightChild = this.values[rightChildIdx];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null && rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildIdx;
        }
      }
      if (swap === null) break;
      this.values[idx] = this.values[swap];
      this.values[swap] = element;
      idx = swap;
    }
  }
}

/**
 * The following class has been modified from what is at
 * https://gist.github.com/Prottoy2938/66849e04b0bac459606059f5f9f3aa1a
 * Key changes include:
 * - changing the `adjacencyList` from string keys (dictionary) to integer strings (list)
 * - adding the `coordMap` attribute to track where graph nodes are located on
 *     the floor map
 * - updating `dijkstra()` method to handle multiple possible endpoints to stop at 
 */
class WeightedGraph {
  constructor() {
    this.adjacencyList = [];
    this.coordMap = [];
  }
  /**
   * Add a node to the graph
   * 
   * @param {number} vertex the index/id of the node
   * @param {*} coord some (x, y) coordinate object
   */
  addVertex(vertex, coord) {
    if (!this.adjacencyList[vertex]) this.adjacencyList[vertex] = [];
    else throw new Error(`Node with index ${vertex} already existed in the graph.`);
    this.coordMap[vertex] = coord;
  }
  /**
   * Connect two nodes with a weighted edge
   * 
   * @param {*} vertex1 one endpoint of the edge
   * @param {*} vertex2 the other endpoint of the edge
   * @param {*} weight the weight (distance) between the endpoints
   */
  addEdge(vertex1, vertex2, weight) {
    this.adjacencyList[vertex1].push({ node: vertex2, weight });
    this.adjacencyList[vertex2].push({ node: vertex1, weight });
  }
  
  /**
   * Run Dijkstra's algorithm with multiple endpoints
   * 
   * @param {number} start the starting location/node
   * @param {number[]} finish a list of possible destinations to end at
   * @returns {{waypoints: number[], legDist: number}} the path to take and the distance of that path
   */
  dijkstra(start, finish) {
    // TODO: update finish to be a list of nodes, rather than a single one
    const nodes = new PriorityQueue();
    const distances = [];
    const previous = [];
    const path = []; // to return at end
    let smallest;
    // build up initial state
    for (let vertex = 0; vertex < this.adjacencyList.length; vertex++) {
      if (this.adjacencyList[vertex] === undefined) {
        throw new Error(`Undefined node found in WeightedGraph at index ${vertex}.
          Cannot complete dijkstra's algorithm with undefined nodes.`);
      } else if (vertex === start) {
        distances[vertex] = 0;
        nodes.enqueue(vertex, 0);
      } else {
        distances[vertex] = Infinity;
        nodes.enqueue(vertex, Infinity);
      }
      previous[vertex] = null;
    }
    // confirm start node was found
    if (nodes.length === 0) throw new Error(`Couldn't find the starting
      index ${start} in graph of size [0..${this.adjacencyList.length - 1}] nodes`);

    // as long as there is something to visit
    while (nodes.values.length) {
      smallest = nodes.dequeue().val;
      if (finish.includes(smallest)) {
        // WE ARE DONE
        // BUILD UP PATH TO RETURN AT END
        while (previous[smallest]) {
          path.push(smallest);
          smallest = previous[smallest];
        }
        break;
      }
      if (smallest || distances[smallest] !== Infinity) {
        for (let neighbour = 0; neighbour < this.adjacencyList[smallest].length; neighbour++) {
          // find neighbouring node
          const edge = this.adjacencyList[smallest][neighbour];
          // calculate new distance to neighbouring node
          const candidate = distances[smallest] + edge.weight;
          const nextNeighbor = edge.node;
          if (candidate < distances[nextNeighbor]) {
            // updating new smallest distance to neighbour
            distances[nextNeighbor] = candidate;
            // updating previous - How we got to neighbour
            previous[nextNeighbor] = smallest;
            // enqueue in priority queue with new priority
            nodes.enqueue(nextNeighbor, candidate);
          }
        }
      }
    }
    if (!finish.includes(smallest)) throw new Error(`Dijkstra's algorithm could not
      find a path from node ${start} to any of nodes [${finish.join(", ")}].`);
    return {waypoints: path.concat(smallest).reverse(), legDist: distances[smallest]};
  }
}
