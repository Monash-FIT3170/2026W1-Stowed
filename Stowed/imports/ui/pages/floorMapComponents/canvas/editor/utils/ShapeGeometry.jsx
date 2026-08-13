export function getShapeBounds(points = []) {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      width: 0,
      height: 0,
    };
  }

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function normaliseShapePoints(points = []) {
  const { minX, minY } = getShapeBounds(points);

  return points.map((point) => ({
    x: point.x - minX,
    y: point.y - minY,
  }));
}
