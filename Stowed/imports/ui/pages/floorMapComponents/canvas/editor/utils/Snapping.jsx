/**
 * Snaps a value to the nearest grid interval.
 *
 * @param {number} value        - Position in pixels.
 * @param {number} snapInterval - Grid cell size in pixels.
 * 
 * @returns {number}
 */
export function snapToGrid(value, snapInterval) {
    return Math.round(value / snapInterval) * snapInterval;
  }