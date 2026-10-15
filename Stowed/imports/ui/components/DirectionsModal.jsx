import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Meteor } from "meteor/meteor";
import { EditorProvider } from "../pages/floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "../pages/floorMapComponents/canvas/components/Canvas";
import "./DirectionsModal.css";

const noop = () => {};

export function DirectionsModal({ request, onClose }) {
  const { floorMapId, floorName, siteName, productIds, productNames } = request;
  const [startingPoint, setStartingPoint] = useState(null);
  const [isSelectingStart, setIsSelectingStart] = useState(true);
  const [route, setRoute] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleStartSelect(point) {
    setStartingPoint(point);
    setIsSelectingStart(false);
    setIsPlanning(true);
    setError("");
    setRoute(null);
    try {
      const planned = await Meteor.callAsync("floorMapRoutes.generate", {
        floorMapId,
        start: point,
        productIds,
      });
      if (planned.stops.length === 0) {
        setError("None of those products can be reached from the walkways on this floor.");
      } else {
        setRoute(planned);
      }
    } catch (callError) {
      setError(callError.reason || callError.message || "Could not plan a route.");
    } finally {
      setIsPlanning(false);
    }
  }

  function handleChangeLocation() {
    setRoute(null);
    setError("");
    setIsSelectingStart(true);
  }

  let status = "Click the map where you are standing now.";
  if (isPlanning) status = "Finding the shortest route…";
  else if (error) status = error;
  else if (route) {
    status = `${route.stops.length} ${route.stops.length === 1 ? "stop" : "stops"} · ${route.distance.toFixed(1)} m`;
  }

  return createPortal(
    <div className="directions-modal__overlay" onClick={onClose}>
      <div
        className="directions-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Directions"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="directions-modal__header">
          <div>
            <h2>Directions</h2>
            <p>{[siteName, floorName].filter(Boolean).join(" – ")}</p>
          </div>
          <button type="button" aria-label="Close directions" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={`directions-modal__status${error ? " is-error" : ""}`} role="status">
          <span>{status}</span>
          {!isSelectingStart && !isPlanning && (
            <button type="button" onClick={handleChangeLocation}>
              Change my location
            </button>
          )}
        </div>

        <div className="directions-modal__map">
          <EditorProvider key={floorMapId} floorMapId={floorMapId}>
            <Canvas
              style={{ display: "block", width: "100%", height: "100%" }}
              selectedStorageUnitId={null}
              setSelectedStorageUnitId={noop}
              startingPoint={startingPoint}
              plannedRoute={route}
              isSelectingStart={isSelectingStart}
              onStartingPointSelect={handleStartSelect}
            />
          </EditorProvider>
        </div>

        {route && (
          <ol className="directions-modal__stops">
            {route.stops.map((stop, index) => (
              <li key={`${stop.nodeId}-${index}`}>
                {stop.productIds.map((id) => productNames[id] ?? "Product").join(", ")}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
}
