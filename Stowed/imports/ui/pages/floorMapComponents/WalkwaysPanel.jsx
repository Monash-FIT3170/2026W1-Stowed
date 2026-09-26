import { COLOURS } from "./FloorMapStyles";
import { buttonStyles } from "./FloorMapStyles";
import { useState} from "react";
import "../../Global.css";
import "../FloorMapPage.css";

export function WalkwaysPanel({
    activeTool,
    setActiveTool
}) {

  const [isAddingWalkway, setIsAddingWalkway] = useState(false);

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

        {!isAddingWalkway ? (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px"
            }}
        >
            <button
                type="button"
                onClick={() => {
                  setActiveTool("ADD_WALKWAY");
                  setIsAddingWalkway(true);
                }}
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

        ): 
          <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px"
            }}
          >
            <button
                className="btn-primary"
                type="button"
                onClick={() => {setIsAddingWalkway(false)}}
            >
                Save
            </button>

            <button
                className="btn-danger"
                type="button"
                onClick={() => {setIsAddingWalkway(false)}}
              
            >
                Delete
            </button>
        </div>
        }
    </div>
  );
}