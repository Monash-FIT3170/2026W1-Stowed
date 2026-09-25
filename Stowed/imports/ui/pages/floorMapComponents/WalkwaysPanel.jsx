import { COLOURS } from "./FloorMapStyles";

export function WalkwaysPanel() {
  return (
    <div
      style={{
        padding: "12px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: COLOURS.TEXT_PRIMARY,
          marginBottom: "8px",
        }}
      >
        Walkways
      </div>

      <div
        style={{
          fontSize: "11px",
          color: COLOURS.TEXT_MUTED,
        }}
      >
        Create and manage walkways on the floor map.
      </div>
    </div>
  );
}