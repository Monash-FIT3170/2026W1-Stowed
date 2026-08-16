import { useState } from "react";
import { Stage, Layer, Circle } from "react-konva";
import { CANVAS_CONFIG } from "./canvas/CanvasConfig";
import { Meteor } from "meteor/meteor";
import { buttonStyles } from "./FloorMapStyles";

export function CreateShapeModal({ onClose, shape = null }) {
  const [shapeName, setShapeName] = useState(
    shape?.name ?? "",
  );

  const canvasWidth = 800;
  const canvasHeight = 300;

  const [points, setPoints] = useState(
    shape?.points?.map((point) => ({
      x: point.x,
      y: point.y,
    })) ?? [],
  );

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

  const handleCanvasClick = (event) => {
    const stage = event.target.getStage();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const x = pointer.x / CANVAS_CONFIG.PIXELS_PER_METER;
    const y = pointer.y / CANVAS_CONFIG.PIXELS_PER_METER;

    setPoints((currentPoints) => [
      ...currentPoints,
      {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
      },
    ]);
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
      if (shape) {
        await Meteor.callAsync("mapShapes.update", {
          orgId: shape.orgId,
          shapeId: shape.shapeId,
          name: trimmedName,
          points: formattedPoints,
          gridReference: shape.gridReference ?? {
            x: 0,
            y: 0,
          },
        });
      } else {
        await Meteor.callAsync("mapShapes.create", {
          name: trimmedName,
          points: formattedPoints,
          gridReference: {
            x: 0,
            y: 0,
          },
        });
      }

      setShapeName("");
      setPoints([]);

      onClose();

    } catch (error) {
      console.error("Failed to save shape:", error);
      alert(error.reason || "Failed to save shape.");
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.title}>
            {shape ? "Edit Shape" : "Shape Editor"}
          </h2>

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
              {shape ? "Save Changes" : "Save Shape"}
            </button>
          </div>
        </div>

        <input
          type="text"
          value={shapeName}
          onChange={(event) => setShapeName(event.target.value)}
          placeholder="Enter shape name"
          style={styles.nameInput}
        />

        <div style={styles.canvasSection}>
          <div style={styles.canvasHeader}>
            <div>
              <div style={styles.canvasTitle}>Place Points on Canvas</div>
              <div style={styles.canvasDescription}>
                Click anywhere on the canvas to create a point automatically.
              </div>
            </div>

            {points.length > 0 && (
              <button
                type="button"
                onClick={() => setPoints([])}
                style={styles.clearButton}
              >
                Clear Points
              </button>
            )}
          </div>

          <div style={styles.canvasWrapper}>
            <Stage
              width={canvasWidth}
              height={canvasHeight}
              onClick={handleCanvasClick}
              style={{
                backgroundColor: "#fbfaf8",
                cursor: "crosshair",
              }}
            >
              <Layer>
                {points.map((point, index) => {
                  if (point.x === "" || point.y === "") {
                    return null;
                  }

                  const x = Number(point.x);
                  const y = Number(point.y);

                  if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    return null;
                  }

                  return (
                    <Circle
                      key={index}
                      x={x * CANVAS_CONFIG.PIXELS_PER_METER}
                      y={y * CANVAS_CONFIG.PIXELS_PER_METER}
                      radius={6}
                      fill="#c45127"
                    />
                  );
                })}
              </Layer>
            </Stage>
          </div>
        </div>

        <div style={styles.pointsSection}>
          <div style={styles.pointsHeader}>
            <div>
              <div style={styles.pointsTitle}>Point Coordinates</div>
              <div style={styles.canvasDescription}>
                Add a point manually or edit coordinates created from the canvas.
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddPoint}
              style={{
                ...buttonStyles.base,
                ...buttonStyles.secondary,
              }}
            >
              + Add Point Manually
            </button>
          </div>

          {points.length > 0 && (
            <div style={styles.pointsContainer}>
              {points.map((point, index) => (
                <div key={index} style={styles.pointSection}>
                  <div style={styles.pointHeader}>
                    <span style={styles.pointTitle}>
                      Point {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemovePoint(index)}
                      style={styles.removeButton}
                    >
                      Remove
                    </button>
                  </div>

                  <div style={styles.pointRow}>
                    <label style={styles.coordinateGroup}>
                      <span style={styles.coordinateLabel}>X</span>

                      <input
                        type="number"
                        value={point.x}
                        onChange={(event) =>
                          handlePointChange(
                            index,
                            "x",
                            event.target.value,
                          )
                        }
                        style={styles.coordinateInput}
                      />
                    </label>

                    <label style={styles.coordinateGroup}>
                      <span style={styles.coordinateLabel}>Y</span>

                      <input
                        type="number"
                        value={point.y}
                        onChange={(event) =>
                          handlePointChange(
                            index,
                            "y",
                            event.target.value,
                          )
                        }
                        style={styles.coordinateInput}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
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
    width: "62vw",
    maxWidth: 960,
    maxHeight: "86vh",
    overflowY: "auto",
    padding: "28px 30px",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.18)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: "#1f1f1f",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },

  nameInput: {
    width: 220,
    padding: "10px 12px",
    border: "1px solid #d8d1c8",
    borderRadius: 8,
    fontSize: 14,
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
  },

  canvasSection: {
    marginTop: 22,
    padding: 16,
    border: "1px solid #e3ddd5",
    borderRadius: 10,
    backgroundColor: "#fbfaf8",
  },

  canvasHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  canvasTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#2a2a2a",
  },

  canvasDescription: {
    marginTop: 4,
    fontSize: 12,
    color: "#77716b",
  },

  clearButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#b94f2a",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },

  canvasWrapper: {
    width: "100%",
    border: "1px solid #ddd6ce",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },

  pointsSection: {
    marginTop: 20,
    padding: 16,
    border: "1px solid #e3ddd5",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },

  pointsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  pointsTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#2a2a2a",
  },

  pointsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  pointSection: {
    padding: 12,
    border: "1px solid #e2ddd7",
    borderRadius: 8,
    backgroundColor: "#fbfaf8",
    minWidth: 0,
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
    color: "#333333",
  },

  pointRow: {
    display: "flex",
    gap: 10,
  },

  coordinateGroup: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    gap: 6,
    minWidth: 0,
    fontSize: 12,
  },

  coordinateLabel: {
    color: "#66615c",
    fontWeight: 500,
  },

  coordinateInput: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "7px 8px",
    border: "1px solid #d8d1c8",
    borderRadius: 7,
    fontSize: 13,
    backgroundColor: "#ffffff",
  },

  removeButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#b42318",
    cursor: "pointer",
    fontSize: 12,
  },

  manualButtonWrapper: {
    marginTop: 14,
    display: "flex",
    justifyContent: "flex-end",
  },
};
