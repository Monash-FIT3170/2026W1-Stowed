


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

    let min = dotProd(points[0], axis);
    let max = min;

    for (let i = 1; i < points.length; i++) {

        const projection = dotProd(points[i], axis);

        if (projection < min) {
            min = projection;
        }

        if (projection > max) {
            max = projection;
        }
    }

    return {
        min,
        max
    };
}

/**
 * Checks if an overlap exists between two projections
 * 
 * @param {*} projection1 
 * @param {*} projection2 
 * @returns if an overlap has occurred
 */
const overlap = (projection1, projection2) => {
    return !(projection1.max < projection2.min || projection2.max < projection1.min);
}


/**
 * Calculates the vector for the edge between two points
 */
const getEdgeVector = (p1, p2) => ({
    x: p2.x - p1.x,
    y: p2.y - p1.y
});

/**
 * Calculates the dot product between two vectors 
 * 
 * @param {*} v1 vector 1 (the axis to map to)
 * @param {*} v2 vector 2 (the point to project from)
 * @returns 
 */
const dotProd = (v1, v2) => v1.x * v2.x + v1.y * v2.y;


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