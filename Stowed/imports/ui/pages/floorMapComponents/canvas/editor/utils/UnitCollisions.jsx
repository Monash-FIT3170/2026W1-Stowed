// File to check for collisions between different objects on the floor map designer page
export { isRectRectIntersecting, calcDistance, isRangeIntersecting, isCircleCircleIntersecting };

/**
 * A boolean check if two intervals overlap
 * note: sharing a boundary value is considered NOT to be an intersection
 * 
 * @param {typeof {lower: number, upper: number}} intervalA 
 * @param {typeof {lower: number, upper: number}} intervalB 
 * @returns {boolean}
 */
const isRangeIntersecting = (intervalA, intervalB) => !(
    intervalA.upper <= intervalB.lower
    || intervalB.upper <= intervalA.lower
);

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
}

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
}

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
    return (centerDistance < (circ1.radius + circ2.radius));
}