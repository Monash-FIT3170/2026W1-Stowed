import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useParams } from "react-router-dom";
import { useState } from "react";

import { FloorMaps, Sites } from "/imports/api/locations/collections";
import { EditorProvider } from "./floorMapComponents/canvas/editor/EditorContext";
import { pageStyles, COLOURS } from "./floorMapComponents/FloorMapStyles";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";

import "../Global.css";
import "./FloorMapPage.css";

/**
 * FLOOR MAP
 * Read-only floor map, so a customer can find where an item is shelved.
 *
 * TODO for team:
 *  - Highlight the location of a product arrived at from search
 */

export function CustomerFloorMapPage() {
  const { floorMapId } = useParams();
  const [selectedFloorMapId, setSelectedFloorMapId] = useState(() => {
    return localStorage.getItem("customerFloorMapId") ?? floorMapId ?? null;
  });

  // Fetch all sites, floor maps
  const { sites, floorMaps, locationsReady } = useTracker(() => {
    const handle = Meteor.subscribe("locations.all");
    return {
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      locationsReady: handle.ready(),
    };
  }, []);

  // Filter out private floor maps
  const publicFloorMaps = floorMaps.filter(
    (floorMap) => floorMap.isPrivate !== true
  );

  // Filter out sites that have no public floor maps
  const publicSites = sites.filter(
    (site) => publicFloorMaps.some(
      (floorMap) => floorMap.siteId === site._id
    )
  );

  // Find the current floor map or default to the first public floor map
  const currentFloorMap =
    publicFloorMaps.find(
      (floorMap) => floorMap._id === selectedFloorMapId
    ) ??
    publicFloorMaps[0] ??
    null;

  // If there are no public floor maps available, display a message to the user
  if (locationsReady && !currentFloorMap) {
    return (
      <div className="customer-page">
        <h1 className="customer-page-title">Floor Map</h1>
        <p>There are currently no floor maps available to view.</p>
      </div>
    );
  }

  // Find the current site based on the current floor map's siteId
  const currentSite = publicSites.find(
    (site) => site._id === currentFloorMap?.siteId
  );

  // Filter the public floor maps to only include those that belong to the current site
  const siteFloorMaps = currentSite
    ? publicFloorMaps.filter(
      (floorMap) => floorMap.siteId === currentSite._id
    )
    : [];


  return (
    <div className="customer-page">
      <h1 className="customer-page-title">Floor Map</h1>

      {locationsReady && currentFloorMap && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
            }}
          >
            {/* SITE SELECT DROPDOWN */}
            {publicSites.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: COLOURS.TEXT_MUTED,
                  }}
                >
                  Site
                </span>

                <select
                  value={currentSite?._id ?? ""}
                  onChange={(e) => {
                    const targetSiteId = e.target.value;

                    const targetMap = publicFloorMaps.find(
                      (floorMap) => floorMap.siteId === targetSiteId
                    );

                    if (targetMap) {
                      setSelectedFloorMapId(targetMap._id);
                      localStorage.setItem("customerFloorMapId", targetMap._id);
                    }
                  }}
                  aria-label="Select site"
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: COLOURS.TEXT_PRIMARY,
                    background: COLOURS.CARD_BG,
                    border: `1px solid ${COLOURS.CARD_BORDER}`,
                    borderRadius: "8px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {publicSites.map((site) => (
                    <option key={site._id} value={site._id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* FLOOR MAP SELECT DROPDOWN */}
            {siteFloorMaps.length > 1 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: COLOURS.TEXT_MUTED,
                  }}
                >
                  Floor Map
                </span>

                <select
                  value={currentFloorMap._id}
                  onChange={(e) => {
                    const newFloorMapId = e.target.value;

                    setSelectedFloorMapId(newFloorMapId);
                    localStorage.setItem("customerFloorMapId", newFloorMapId);
                  }}
                  aria-label="Select floor map"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: COLOURS.TEXT_MUTED,
                    background: COLOURS.CARD_BG,
                    border: `1px solid ${COLOURS.CARD_BORDER}`,
                    borderRadius: "8px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {siteFloorMaps.map((floorMap) => (
                    <option key={floorMap._id} value={floorMap._id}>
                      {floorMap.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* READ-ONLY FLOOR MAP DISPLAY */}
          <div
            style={{
              ...pageStyles.canvasArea,
              height: "600px",
              width: "100%",
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
              position: "relative",
              background: "var(--bg-primary)",
            }}
          >
            <EditorProvider
              key={currentFloorMap._id}
              floorMapId={currentFloorMap._id}
              isCanvasEditMode={false}
              setCanvasEditMode={() => { }}
            >
              <Canvas
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                }}
                isCanvasEditMode={false}
                selectedStorageUnitId={null}
                setSelectedStorageUnitId={() => { }}
                setTooltip={() => { }}
                lowStockByUnitId={{}}
              />
            </EditorProvider>
          </div>
        </>
      )}
    </div>
  );
}