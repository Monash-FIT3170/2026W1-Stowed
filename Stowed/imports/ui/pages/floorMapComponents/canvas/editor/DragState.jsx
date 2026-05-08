/**
 * Shared mutable state for the current HTML5 drag operation.
 * Due to security reasons data cannot be directly accessed from HTML5 drag operation
 * so put it into this type and then share
 */
export const dragState = {
    /** @type {{name: string, width: number, height: number, fill: string, type?: string} | null} */
    template: null,
  };