import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { FloorMaps, Sites, StorageLocations } from "/imports/api/locations/collections";
import { EditorProvider, useEditor } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { LocationProductsPanel } from "./floorMapComponents/LocationProductsPanel";
import { ProductSearchPanel } from "./floorMapComponents/ProductSearchPanel";
import "../Global.css";
import "./FloorMapDetailPage.css";

/** How long the accent ring stays on a unit after "Show on map". */
const HIGHLIGHT_MS = 2600;

export function findLocationUnit(locationId, storageLocations, units) {
  const location = storageLocations.find((candidate) => candidate._id === locationId);
  return (
    units.find((candidate) => (candidate._id ?? candidate.id) === location?.storageUnitId) ?? null
  );
}

function FloorMapDetailInner({ floorMapId }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedLocationId = searchParams.get("location");
  const { units, selectedUnit, setSelectedUnit } = useEditor();

  const canvasRef = useRef(null);
  const highlightTimer = useRef(null);
  const openedLocationRef = useRef(null);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [highlightedUnitId, setHighlightedUnitId] = useState(null);
  const [focusLocationId, setFocusLocationId] = useState(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const { sites, floorMaps, storageLocations, ready } = useTracker(() => {
    const handle = Meteor.subscribe("locations.all");
    return {
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      storageLocations: StorageLocations.find().fetch(),
      ready: handle.ready(),
    };
  }, []);

  const currentFloorMap = floorMaps.find((map) => map._id === floorMapId) ?? floorMaps[0];
  const currentSite = sites.find((site) => site._id === currentFloorMap?.siteId);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  useEffect(() => {
    if (!ready || !requestedLocationId || openedLocationRef.current === requestedLocationId) return;
    const unit = findLocationUnit(requestedLocationId, storageLocations, units);
    if (!unit) return;

    openedLocationRef.current = requestedLocationId;
    setSelectedUnit(unit);
    setFocusLocationId(requestedLocationId);
    setFocusNonce((nonce) => nonce + 1);
    setIsPanelOpen(true);
    setHighlightedUnitId(unit._id ?? unit.id);
    canvasRef.current?.focusUnit(unit._id ?? unit.id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedUnitId(null), HIGHLIGHT_MS);
  }, [ready, requestedLocationId, storageLocations, units, setSelectedUnit]);

  function openUnit(unitId, locationId = null) {
    const unit = units.find((candidate) => (candidate._id ?? candidate.id) === unitId) ?? null;
    setSelectedUnit(unit);
    setFocusLocationId(locationId);
    setFocusNonce((n) => n + 1);
    setIsPanelOpen(!!unit);
  }

  /** Pan to the unit holding a search hit, flash it, and open it up. */
  function handleShowOnMap(entry) {
    const unitId = entry.unit._id;
    canvasRef.current?.focusUnit(unitId);
    openUnit(unitId, entry.location._id);

    setHighlightedUnitId(unitId);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedUnitId(null), HIGHLIGHT_MS);
  }

  return (
    <div className="fmd-page">
      <header className="fmd-topbar">
        <div className="fmd-topbar-left">
          <div className="breadcrumb">
            <Link to="/floor-map" className="breadcrumb-link">
              Floor Map
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Detailed view</span>
          </div>
          <h1 className="fmd-title">
            {currentSite?.name ? `${currentSite.name} — ` : ""}
            <em>{currentFloorMap?.name ?? "Floor Map"}</em>
          </h1>
        </div>

        <div className="fmd-topbar-right">
          <ProductSearchPanel floorMapId={currentFloorMap?._id} onShowOnMap={handleShowOnMap} />
          <button
            type="button"
            className="fmd-back-btn"
            onClick={() =>
              navigate(currentFloorMap ? `/floor-map/${currentFloorMap._id}` : "/floor-map")
            }
          >
            Back to floor map
          </button>
        </div>
      </header>

      <div className="fmd-body">
        <div className="fmd-canvas">
          {ready && (
            <Canvas
              ref={canvasRef}
              key={floorMapId ?? "default"}
              style={{ display: "block", width: "100%", height: "100%" }}
              isCanvasEditMode={false}
              setSelectedStorageUnitId={(unitId) => openUnit(unitId)}
              highlightedUnitId={highlightedUnitId}
            />
          )}
          {!isPanelOpen && (
            <p className="fmd-hint">Select a storage unit to see the locations inside it.</p>
          )}
        </div>

        {selectedUnit && isPanelOpen && (
          <LocationProductsPanel
            unit={selectedUnit}
            focusLocationId={focusLocationId}
            focusNonce={focusNonce}
            onClose={() => setIsPanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Read-only, drill-down view of a floor map: the same canvas as the editor,
 * but clicking a unit opens the storage locations inside it and the products
 * stocked in each.
 */
export function FloorMapDetailPage() {
  const { floorMapId } = useParams();
  const noop = () => {};

  return (
    <EditorProvider
      key={floorMapId ?? "default"}
      floorMapId={floorMapId}
      isCanvasEditMode={false}
      setCanvasEditMode={noop}
    >
      <FloorMapDetailInner floorMapId={floorMapId} />
    </EditorProvider>
  );
}
