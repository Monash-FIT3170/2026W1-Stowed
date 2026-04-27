// File to check for collisions between different objects on the floor map designer page

const isRangeIntersecting = (minA, maxA) => (minB, maxB) => !(maxA < minB || maxB < minA);

const isRectRectIntersecting = (rect1) => (rect2) => {
    const minX1 = rect1.xPos;
    const maxX1 = rect1.xPos + rect1.width;
    const minY1 = rect1.yPos;
    const maxY1 = rect1.yPos + rect1.height;

    const domIntersectWith = isRangeIntersecting(minX1, maxX1);
    const ranIntersectWith = isRangeIntersecting(minY1, maxY1);

    const minX2 = rect2.xPos;
    const maxX2 = rect2.xPos + rect2.width;
    const minY2 = rect2.yPos;
    const maxY2 = rect2.yPos + rect2.height;

    // check intersecting domain
    const domIntersect = domIntersectWith(minX2, maxX2);

    // check intersecting range
    const ranIntersect = ranIntersectWith(minY2, maxY2);

    return domIntersect & ranIntersect;
}

const calcDistance = (x1, y1) => (x2, y2) => {
    // distance formula
    return ((x2 - x1)**2 + (y2 - y1)**2) ** (1/2);
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