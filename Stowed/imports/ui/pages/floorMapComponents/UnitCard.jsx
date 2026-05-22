import {useState} from "react";
import { storagePanelStyles, COLOURS } from "./FloorMapStyles";
import { CANVAS_CONFIG } from "./canvas/CanvasConfig";
import { dragState } from "./canvas/editor/DragState";

/**
 * Draggable card representing a storage unit
 * 
 * @param {{name: string, width: number, height: number, fill: string, type?: string}} unit - The unit template for this card
 * @param {() => void} onClick - Handler triggered when the card is clicked 
 * 
 * @returns {JSX.Element} - Unit card UI element
 */
export function UnitCard({ unit, onClick }) {
    const [hovered, setHovered] = useState(false);
    
    // DRAG METHODS
    function handleDragStart(e) {
        // store unit in drag event so canvas can drop it in
        e.dataTransfer.setData("unit", JSON.stringify(unit));
        // write to shared dragState so Canvas can read the template during dragover 
        dragState.template = unit;

        // Show the storage unit as it would appear on canvas instead of the plain unit card
        // when dragging. To do this build offscreen canvas that renders the unit preview.
        const offscreen = document.createElement("canvas");
        const ctx = offscreen.getContext("2d");

        const wPixels = unit.width  * CANVAS_CONFIG.GRID_SIZE;
        const hPixels = unit.height * CANVAS_CONFIG.GRID_SIZE;
        offscreen.width  = wPixels;
        offscreen.height = hPixels;

        // draw unit body
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = unit.fill;
        ctx.beginPath();
        ctx.roundRect(0, 0, wPixels, hPixels, 4);
        ctx.fill();

        // Draw unit label 
        ctx.globalAlpha = 1;
        ctx.fillStyle   = "white";
        ctx.font        = "12px sans-serif";
        ctx.textAlign   = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(unit.name, wPixels / 2, hPixels / 2);

        e.dataTransfer.setDragImage(offscreen, wPixels / 2, hPixels / 2);

        // prevent memory leak by allowing browser to capture it, then delete it
        document.body.appendChild(offscreen);
        offscreen.style.position = "absolute";
        offscreen.style.top      = "-9999px";
        setTimeout(() => document.body.removeChild(offscreen), 0);
    }

  function handleDragEnd() {
    // Clear shared drag state once the drag operation is finished
    dragState.template = null;
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        ...storagePanelStyles.card,
        background: hovered
          ? COLOURS.UNIT_CARD_HOVER
          : storagePanelStyles.card.background,
        cursor: "grab",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...storagePanelStyles.swatch, background: unit.fill }} />

            <p style={storagePanelStyles.cardName}>{unit.name}</p>
            <p style={storagePanelStyles.cardSub}>{unit.width} × {unit.height}m</p>
        </div>
    );
  }