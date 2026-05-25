// File to check for collisions between different objects on the floor map designer page

export { isRectRectIntersecting, calcDistance, isRangeIntersecting, isCircleCircleIntersecting };
const isRangeIntersecting = (intervalA, intervalB) => !(
    intervalA.upper <= intervalB.lower
    || intervalB.upper <= intervalA.lower
);

const isRectRectIntersecting = (rect1) => (rect2) => {
    // check intersecting domain
    const domIntersect = isRangeIntersecting(rect1.dom, rect2.dom);

    // check intersecting range
    const ranIntersect = isRangeIntersecting(rect1.ran, rect2.ran);

    return domIntersect && ranIntersect;
}

const calcDistance = (x1, y1) => (x2, y2) => {
    // distance formula
    return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** (1 / 2);
}

const isCircleCircleIntersecting = (circ1) => (circ2) => {
    const distFrom = calcDistance(circ1.centerX, circ1.centerY);
    const centerDistance = distFrom(circ2.centerX, circ2.centerY);
    return (centerDistance < (circ1.radius + circ2.radius));
}