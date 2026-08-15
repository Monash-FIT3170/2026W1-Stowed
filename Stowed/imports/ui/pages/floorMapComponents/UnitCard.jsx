import { useState } from "react";
import { storagePanelStyles, COLOURS } from "./FloorMapStyles";

/**
 * Card representing an already-placed storage unit
 *
 * @param {{name: string, width: number, height: number, fill: string, type?: string}} unit
 * @param {() => void} onClick - Handler triggered when the card is clicked
 *
 * @returns {JSX.Element} - Unit card UI element
 */
export function UnitCard({ unit, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...storagePanelStyles.card,
        background: hovered ? COLOURS.UNIT_CARD_HOVER : storagePanelStyles.card.background,
        cursor: "pointer",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...storagePanelStyles.swatch, background: unit.fill }} />

      <p style={storagePanelStyles.cardName}>{unit.name}</p>
      <p style={storagePanelStyles.cardSub}>
        {unit.width} × {unit.height}m
      </p>
    </div>
  );
}
