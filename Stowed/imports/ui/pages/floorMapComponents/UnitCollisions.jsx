// File to check for collisions between different objects on the floor map designer page

export { isRectRectIntersecting };

const isRangeIntersecting = (intervalA, intervalB) => !(
    intervalA.upper <= intervalB.lower
    || intervalB.upper <= intervalA.lower
);

const isRectRectIntersecting = (rect1) => (rect2) => {
    // check intersecting domain
    const domIntersect = isRangeIntersecting(rect1.dom, rect2.dom);

    // check intersecting range
    const ranIntersect = isRangeIntersecting(rect1.ran, rect2.ran);

    return domIntersect & ranIntersect;
}

const calcDistance = (x1, y1) => (x2, y2) => {
    // distance formula
    return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** (1 / 2);
}

const isCircleCircleIntersecting = (circ1) => (circ2) => {
    // (xPos, yPos) is assumed to be the top left corner of the bounding box of the circle
    const circCenterX1 = circ1.xPos + circ1.radius;
    const circCenterY1 = circ1.yPos + circ1.radius;

    const distFrom = calcDistance(circCenterX1, circCenterY1);

    const circCenterX2 = circ2.xPos + circ2.radius;
    const circCenterY2 = circ2.yPos + circ2.radius;

    const centerDistance = distFrom(circCenterX2, circCenterY2);

    return (centerDistance <= (circ1.radius + circ2.radius));
}