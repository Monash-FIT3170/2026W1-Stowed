import { useEffect, useState } from "react";
import { locationPanelStyles, COLOURS } from "./FloorMapStyles";

/**
 * Small panel for editing a selected storage unit's own properties (name, colour) -
 * as opposed to StorageLocationPanel, which manages the locations inside it.
 *
 * @param {{ id?: string, _id?: string, name: string, fill?: string }} unit
 * @param {(name: string) => void} onRename
 * @param {(fill: string) => void} onColourChange
 *
 * @returns {JSX.Element}
 */
export function UnitDetailsPanel({ unit, onRename, onColourChange }) {
  const [name, setName] = useState(unit.name);

  // Keep the draft in sync when a different unit is selected
  useEffect(() => {
    setName(unit.name);
  }, [unit.id, unit._id]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== unit.name) {
      onRename(trimmed);
    } else {
      setName(unit.name);
    }
  }

  return (
    <div style={locationPanelStyles.panel}>
      <p style={locationPanelStyles.title}>Unit Details</p>

      <div style={locationPanelStyles.form}>
        <label style={locationPanelStyles.label} htmlFor="unit-name">
          Name
        </label>
        <input
          id="unit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.target.blur();
          }}
          style={locationPanelStyles.input}
          placeholder="Unit name"
        />

        <label style={locationPanelStyles.label} htmlFor="unit-colour">
          Colour
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="unit-colour"
            type="color"
            value={unit.fill || COLOURS.UNIT_DEFAULT}
            onChange={(e) => onColourChange(e.target.value)}
            style={{
              width: 36,
              height: 28,
              padding: 0,
              border: `1px solid ${COLOURS.BUTTON_BORDER}`,
              borderRadius: 6,
              cursor: "pointer",
              background: "none",
            }}
          />
          <span style={{ fontSize: 11, color: COLOURS.TEXT_MUTED }}>
            {unit.fill || COLOURS.UNIT_DEFAULT}
          </span>
        </div>
      </div>
    </div>
  );
}
