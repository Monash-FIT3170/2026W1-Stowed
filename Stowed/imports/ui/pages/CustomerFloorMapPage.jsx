import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { FloorMaps, Sites } from "/imports/api/locations/collections";
import { getCustomerOrgCode } from "../customerSession";
import { EditorProvider } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { MapSelectors, MapState } from "./floorMapComponents/MapControls";
import { firstMapForSite, publicMaps, selectAvailableMap } from "./floorMapComponents/mapSelection";
import "./FloorMapPage.css";

const STORAGE_KEY = "customerFloorMapId";

export function CustomerFloorMapPage() {
  const orgCode = getCustomerOrgCode();
  const [selectedFloorMapId, setSelectedFloorMapId] = useState(() =>
    window.localStorage.getItem(STORAGE_KEY),
  );

  const { sites, floorMaps, locationsReady } = useTracker(() => {
    const handle = Meteor.subscribe("locations.publicFloorMaps", orgCode ?? "");
    return {
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      locationsReady: handle.ready(),
    };
  }, [orgCode]);

  const visibleMaps = orgCode ? publicMaps(floorMaps) : [];
  const visibleSites = sites.filter((site) => visibleMaps.some((map) => map.siteId === site._id));
  const currentFloorMap = selectAvailableMap(visibleMaps, selectedFloorMapId);
  const currentSite = visibleSites.find((site) => site._id === currentFloorMap?.siteId);

  useEffect(() => {
    if (locationsReady && currentFloorMap && currentFloorMap._id !== selectedFloorMapId) {
      window.localStorage.setItem(STORAGE_KEY, currentFloorMap._id);
    }
  }, [locationsReady, currentFloorMap, selectedFloorMapId]);

  function chooseMap(mapId) {
    if (!visibleMaps.some((map) => map._id === mapId)) return;
    setSelectedFloorMapId(mapId);
    window.localStorage.setItem(STORAGE_KEY, mapId);
  }

  return (
    <section className="customer-page customer-floor-map-page" aria-labelledby="customer-map-title">
      <header className="customer-floor-map-heading">
        <div>
          <h1 id="customer-map-title" className="customer-page-title">
            Floor Map
          </h1>
          <p>Find where products are located.</p>
        </div>
        {locationsReady && currentFloorMap && (
          <MapSelectors
            context="public"
            sites={visibleSites}
            floorMaps={visibleMaps}
            currentSite={currentSite}
            currentFloorMap={currentFloorMap}
            onSiteChange={(siteId) => {
              const map = firstMapForSite(visibleMaps, siteId);
              if (map) chooseMap(map._id);
            }}
            onFloorMapChange={chooseMap}
          />
        )}
      </header>
      <div className="floor-map-viewport customer-floor-map-viewport">
        {!locationsReady ? (
          <MapState loading title="Loading floor maps…" />
        ) : !currentFloorMap ? (
          <MapState
            title="No public floor maps yet"
            description="There is no map available for this location right now."
          />
        ) : (
          <EditorProvider
            key={currentFloorMap._id}
            floorMapId={currentFloorMap._id}
            publicOrgCode={orgCode}
            isCanvasEditMode={false}
            setCanvasEditMode={() => {}}
          >
            <Canvas isCanvasEditMode={false} publicView />
          </EditorProvider>
        )}
      </div>
    </section>
  );
}
