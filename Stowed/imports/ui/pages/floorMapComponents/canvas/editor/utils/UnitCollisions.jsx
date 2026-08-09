import { getBoundingBox } from "../../../../../../api/locations/shapeUtils";

// File to check for collisions between different objects on the floor map designer page
export { 
  isRectRectIntersecting, 
  calcDistance, 
  isRangeIntersecting, 
  isCircleCircleIntersecting, 
  narrowPhaseTest,
  getEdgeVector,
  dotProd,
  normaliseVector, 
  broadPhaseTest };

/**
 * A boolean check if two intervals overlap
 * note: sharing a boundary value is considered NOT to be an intersection
 *
 * @param {typeof {lower: number, upper: number}} intervalA
 * @param {typeof {lower: number, upper: number}} intervalB
 * @returns {boolean}
 */
const isRangeIntersecting = (intervalA, intervalB) =>
  !(intervalA.upper <= intervalB.lower || intervalB.upper <= intervalA.lower);


/**
 * A boolean check to see if two rectangles (in the same plane/orientation) overlap
 * note: sharing a boundary value is considered NOT to be an intersection
 *
 * @param {typeof { dom: { lower: number, upper: number }, ran: { lower: number, upper: number } }} rect1
 * @returns {function(typeof { dom: { lower: number, upper: number }, ran: { lower: number, upper: number } }): boolean}
 */
const isRectRectIntersecting = (rect1) => (rect2) => {
  // check intersecting domain
  const domIntersect = isRangeIntersecting(rect1.dom, rect2.dom);

  // check intersecting range
  const ranIntersect = isRangeIntersecting(rect1.ran, rect2.ran);

  return domIntersect && ranIntersect;
};

/**
 * The 2D distance formula
 *
 * @param {number} x1
 * @param {number} y1
 * @returns {function(number, number): number}
 */
const calcDistance = (x1, y1) => (x2, y2) => {
  // distance formula
  return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** (1 / 2);
};

/**
 * A boolean check to see if two circles (orientation independent) overlap
 * note: sharing a boundary value is considered NOT to be an intersection
 *
 * @param {typeof {centerX: number, centerY: number, radius: number}} circ1
 * @returns {function(typeof {centerX: number, centerY: number, radius: number}): boolean}
 */
const isCircleCircleIntersecting = (circ1) => (circ2) => {
  const distFrom = calcDistance(circ1.centerX, circ1.centerY);
  const centerDistance = distFrom(circ2.centerX, circ2.centerY);
  return centerDistance < circ1.radius + circ2.radius;
};

/**
 * Gets all the axes that are used to check for collisions
 * 
 * @param {*} points the points on the shape
 * @returns 
 */
const getAxes = (points) =>
    points.map((point, i) => {
        const endPoint = points[(i+1) % points.length];

        const edgeVector = getEdgeVector(point, endPoint);

        return normaliseVector({
            x: -edgeVector.y,
            y: edgeVector.x
        });
    })
;


/**
 * Projects shape's points onto given axis, finds the parts
 * of the axis it overlaps with
 * 
 * @param {*} points the points on the shape
 * @param {*} axis the axis to project onto
 * @returns 
 */
const projectOntoAxis = (points, axis) => {

    let lower = dotProd(points[0], axis);
    let upper = lower;

    for (let i = 1; i < points.length; i++) {

        const projection = dotProd(points[i], axis);

        if (projection < lower) {
            lower = projection;
        }

        if (projection > upper) {
            upper = projection;
        }
    }

    return {
        lower: lower,
        upper: upper
    };
}


/**
 * 
 * Conducts a broad phase test using object bounding boxes to check which units
 * are in close proximity to the new one
 * 
 * @param {*} newPoints the points of the new unit to be placed
 * @param {*} units the units already existing on the floormap
 * @returns a list of units whose bounding box intersects with the new one
 */
const broadPhaseTest = (newPoints, units) => {

  newBoundBox = getBoundingBox(newPoints);

  return units.filter((unit) => {
      const oldBoundBox = getBoundingBox(unit.shape.points);

      const xOverlap = newBoundBox.minX < oldBoundBox.maxX && newBoundBox.maxX < oldBoundBox.minX;
      const yOverlap = newBoundBox.minY < oldBoundBox.maxY && newBoundBox.maxY < oldBoundBox.minY;

      return xOverlap && yOverlap;

  })
  

}


/**
 * Checks if a collision exists between a newly created unit and other units on the map
 * 
 * @param {*} newPoints new shape's set of points
 * @param {Object[]} units other units on the map
 * @returns 
 */
const narrowPhaseTest = (newPoints, units) => {
    
    const newAxes = getAxes(newPoints);

    return units.some((unit) => {
        const existingPoints = unit.shape.points;
        const existingAxes = getAxes(existingPoints);

        const  axesToCheck = [...newAxes, ...existingAxes];

        return axesToCheck.every((axis) => {
            const projection1 = projectOntoAxis(newPoints, axis);
            const projection2 = projectOntoAxis(existingPoints, axis);

            return isRangeIntersecting(projection1, projection2);
        })
    })
}


/**
 * Calculates the vector for the edge between two points
 * 
 * @param {*} p1 first point
 * @param {*} p2 second point
 * @returns 
 */
const getEdgeVector = (p1, p2) => ({
    x: p2.x - p1.x,
    y: p2.y - p1.y
})

/**
 * Calculates the dot product between two vectors 
 * 
 * @param {*} v1 vector 1 (the axis to map to)
 * @param {*} v2 vector 2 (the point to project from)
 * @returns 
 */
const dotProd = (v1, v2) => 
    v1.x * v2.x + v1.y * v2.y;


/**
 * Calculates the normal to a vector
 * 
 * @param {*} vector the vector to get the normal of
 * @returns 
 */
const normaliseVector = (vector) => {

    const vectorMagnitude = Math.sqrt(vector.x ** 2 + vector.y ** 2);

    return {
        x: vector.x / vectorMagnitude,
        y: vector.y / vectorMagnitude
    };

};
