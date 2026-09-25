import { COLOURS } from "./FloorMapStyles";
import { buttonStyles } from "./FloorMapStyles";

export function WalkwaysPanel(
    activeTool,
    setActiveTool
) {


  return (
    <div
      style={{
        padding: "12px",
        boxSizing: "border-box"
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
                display: "flex",
                flexDirection: "column",
                gap: "8px"
            }}
        >
            <button
                type="button"
                onClick={() => {setActiveTool("ADD_WALKWAY")}}
                style={{
                ...buttonStyles.base,
                ...buttonStyles.secondary,
                width: "100%",
                padding: "8px 10px",
                 fontSize: 12,
                }}
            >
                +  Add Walkways
            </button>
        </div>
    </div>
  );
}