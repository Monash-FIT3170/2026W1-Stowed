/**
 * dragState.js
 * 
 * Broswers block dataTransfer.getData() when dragging over for security reasons.
 * To avoid this we can use a simple shared ref that UnitCard can write to on dragstart
 * and Cnavas can read during dragover and drop
 */
export const dragState = {
    /** @type {{name: string, width: number, height: number, fill: string, type?: string} | null} */
    template: null,
  };