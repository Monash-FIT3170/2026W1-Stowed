



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
const dotProd = (v1, v2) => p1.x * p2.x + p1.y + p2.y;


/**
 * Calculates the normal to a vector
 * 
 * @param {*} vector the vector to get the normal of
 * @returns 
 */
const getEdgeNormal = (vector) => {

    const vectorMagnitude = Math.sqrt(vector.x ** 2 + vector.y ** 2);

    return {
        x: vector.x / vectorMagnitude,
        y: vector.y / vectorMagnitude
    };

};