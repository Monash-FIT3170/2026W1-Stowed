import {useState} from "react";
import { storagePanelStyles, COLOURS } from "./FloorMapStyles";

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
    
    function handleDragStart(e) {
        // store unit in drag event so canvas can drop it in
        e.dataTransfer.setData("unit", JSON.stringify(unit));
    }

    return (
        <div 
            draggable 
            onDragStart={handleDragStart}
            style={{...storagePanelStyles.card, background: hovered ? COLOURS.UNIT_CARD_HOVER : "black", cursor: "grab"}}
            onClick={onClick}
            onMouseEnter={()=>setHovered(true)}
            onMouseLeave={()=>setHovered(false)}
        >
        
            <div style={{...storagePanelStyles.swatch, background: unit.fill}}/>

            <p style={storagePanelStyles.cardName}>{unit.name}</p>
            <p style={storagePanelStyles.cardSub}>{unit.width} × {unit.height}m</p>
        </div>
    );
  }