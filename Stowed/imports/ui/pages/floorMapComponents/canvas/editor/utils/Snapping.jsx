export function snapToGrid(value, snapInterval) {
    return Math.round(value / snapInterval) * snapInterval;
  }