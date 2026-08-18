import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { buttonStyles } from "./FloorMapStyles";

export function CreateShapeModal({ onClose }) {
  const [shapeName, setShapeName] = useState("");

  const [points, setPoints] = useState([
    { x: "", y: "" },
    { x: "", y: "" },
    { x: "", y: "" },
  ]);

  const handlePointChange = (index, coordinate, value) => {
    setPoints((currentPoints) =>
      currentPoints.map((point, pointIndex) =>
        pointIndex === index
          ? {
              ...point,
              [coordinate]: value,
            }
          : point,
      ),
    );
  };

  const handleAddPoint = () => {
    setPoints((currentPoints) => [
      ...currentPoints,
      {
        x: "",
        y: "",
      },
    ]);
  };

  const handleRemovePoint = (index) => {
    setPoints((currentPoints) => currentPoints.filter((_, pointIndex) => pointIndex !== index));
  };

  const handleSave = async () => {
    const trimmedName = shapeName.trim();

    if (!trimmedName) {
      alert("Please enter a shape name.");
      return;
    }

    if (points.length < 3) {
      alert("A custom shape must have at least three points.");
      return;
    }

    const hasEmptyCoordinate = points.some((point) => point.x === "" || point.y === "");

    if (hasEmptyCoordinate) {
      alert("Please enter both X and Y values for every point.");
      return;
    }

    const formattedPoints = points.map((point) => ({
      x: Number(point.x),
      y: Number(point.y),
    }));

    const hasInvalidCoordinate = formattedPoints.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    );

    if (hasInvalidCoordinate) {
      alert("All coordinates must be valid numbers.");
      return;
    }

    try {
      await Meteor.callAsync("mapShapes.create", {
        name: trimmedName,
        points: formattedPoints,
        gridReference: {
          x: 0,
          y: 0,
        },
      });

      setShapeName("");
      setPoints([
        { x: "", y: "" },
        { x: "", y: "" },
        { x: "", y: "" },
      ]);

      onClose();
    } catch (error) {
      console.error("Failed to save shape:", error);
      alert(error.reason || "Failed to save shape.");
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Create New Shape</h2>

        <label style={styles.label}>
          Shape name
          <input
            type="text"
            value={shapeName}
            onChange={(event) => setShapeName(event.target.value)}
            placeholder="Enter shape name"
            style={styles.fullInput}
          />
        </label>

        <div style={styles.pointsContainer}>
          {points.map((point, index) => (
            <div key={index} style={styles.pointSection}>
              <div style={styles.pointHeader}>
                <span style={styles.pointTitle}>Point {index + 1}</span>

                {points.length > 3 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(index)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={styles.pointRow}>
                <label style={styles.coordinateLabel}>
                  X coordinate
                  <input
                    type="number"
                    value={point.x}
                    onChange={(event) => handlePointChange(index, "x", event.target.value)}
                    style={styles.coordinateInput}
                  />
                </label>

                <label style={styles.coordinateLabel}>
                  Y coordinate
                  <input
                    type="number"
                    value={point.y}
                    onChange={(event) => handlePointChange(index, "y", event.target.value)}
                    style={styles.coordinateInput}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddPoint}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            marginTop: 14,
            width: "100%",
          }}
        >
          Add Another Point
        </button>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...buttonStyles.base,
              ...buttonStyles.secondary,
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              ...buttonStyles.base,
              ...buttonStyles.primary,
            }}
          >
            Save Shape
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    zIndex: 1000,
  },

  modal: {
    width: 420,
    maxHeight: "80vh",
    overflowY: "auto",
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.2)",
  },

  title: {
    marginTop: 0,
    marginBottom: 20,
  },

  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
  },

  fullInput: {
    padding: "9px 10px",
    border: "1px solid #cccccc",
    borderRadius: 8,
    fontSize: 14,
  },

  pointsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 18,
  },

  pointSection: {
    padding: 12,
    border: "1px solid #dddddd",
    borderRadius: 8,
  },

  pointHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  pointTitle: {
    fontSize: 13,
    fontWeight: 600,
  },

  pointRow: {
    display: "flex",
    gap: 12,
  },

  coordinateLabel: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: 5,
    fontSize: 12,
  },

  coordinateInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 9px",
    border: "1px solid #cccccc",
    borderRadius: 7,
  },

  removeButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#b42318",
    cursor: "pointer",
    fontSize: 12,
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
};
