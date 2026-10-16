import { useEffect, useMemo, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useSearchParams } from "react-router-dom";
import { FloorMaps, Sites, StorageUnits } from "/imports/api/locations/collections";
import { getCustomerOrgCode } from "../customerSession";
import { EditorProvider } from "./floorMapComponents/canvas/editor/EditorContext";
import { Canvas } from "./floorMapComponents/canvas/components/Canvas";
import { MapSelectors, MapState } from "./floorMapComponents/MapControls";
import { firstMapForSite, publicMaps, selectAvailableMap } from "./floorMapComponents/mapSelection";
import { CustomerUnitPanel } from "./floorMapComponents/CustomerUnitPanel";
import { CustomerMapSearch } from "./floorMapComponents/CustomerMapSearch";
import { buildPlacements, buildUnitMaps } from "./floorMapComponents/customerMapData";
import "./FloorMapPage.css";
import "./CustomerFloorMapPage.css";

const STORAGE_KEY = "customerFloorMapId";

/** How long the accent ring stays on a unit after "Show on map". */
const HIGHLIGHT_MS = 2600;

/**
 * The shopper catalogue: products with the units and shelves they sit on, and
 * a stock status in place of quantities. Fetched once - a shopper does not
 * need the map to update live.
 */
function useCustomerCatalogue(orgCode) {
  const [products, setProducts] = useState([]);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    if (!orgCode) return undefined;
    let current = true;
    Meteor.callAsync("customer.products.list", { orgCode })
      .then((result) => {
        if (!current) return;
        setProducts(result);
        setLoadState("ready");
      })
      .catch((err) => {
        console.error("Failed to load the catalogue:", err);
        if (current) setLoadState("error");
      });
    return () => {
      current = false;
    };
  }, [orgCode]);

  return { products, loadState };
}

export function publicHighlightedUnitId(unitId, floorMapId, units) {
  return units.some((unit) => unit._id === unitId && unit.floorMapId === floorMapId)
    ? unitId
    : null;
}

export function selectCustomerFloorMap(visibleMaps, selectedFloorMapId, requestedMapId) {
  return selectAvailableMap(visibleMaps, requestedMapId ?? selectedFloorMapId);
}

export function CustomerFloorMapPage() {
  const orgCode = getCustomerOrgCode();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMapId = searchParams.get("map");
  const requestedUnitId = searchParams.get("unit");
  const [selectedFloorMapId, setSelectedFloorMapId] = useState(() =>
    window.localStorage.getItem(STORAGE_KEY),
  );
  const canvasRef = useRef(null);
  const highlightTimer = useRef(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [highlightedUnitId, setHighlightedUnitId] = useState(null);
  const [focusShelfName, setFocusShelfName] = useState(null);
  const [focusNonce, setFocusNonce] = useState(0);
  // Pans the canvas to a unit; held by the canvas until that map has loaded.
  const [focusRequest, setFocusRequest] = useState(null);

  const { products, loadState } = useCustomerCatalogue(orgCode);
  const placements = useMemo(() => buildPlacements(products), [products]);

  const { sites, floorMaps, storageUnits, locationsReady } = useTracker(() => {
    const handle = Meteor.subscribe("locations.publicFloorMaps", orgCode ?? "");
    return {
      sites: Sites.find({}, { sort: { createdAt: 1 } }).fetch(),
      floorMaps: FloorMaps.find({}, { sort: { createdAt: 1 } }).fetch(),
      storageUnits: StorageUnits.find({}, { fields: { floorMapId: 1, name: 1 } }).fetch(),
      locationsReady: handle.ready(),
    };
  }, [orgCode]);

  const visibleMaps = useMemo(() => (orgCode ? publicMaps(floorMaps) : []), [orgCode, floorMaps]);
  const visibleSites = useMemo(
    () => sites.filter((site) => visibleMaps.some((map) => map.siteId === site._id)),
    [sites, visibleMaps],
  );
  const currentFloorMap = selectCustomerFloorMap(visibleMaps, selectedFloorMapId, requestedMapId);
  const currentSite = visibleSites.find((site) => site._id === currentFloorMap?.siteId);
  // A deep link (?unit=, from a product's "Open in floor map") keeps its unit
  // highlighted; a "Show on map" flash takes over while it runs.
  const linkedUnitId = publicHighlightedUnitId(requestedUnitId, currentFloorMap?._id, storageUnits);

  // Arriving by that link should also open the unit and bring it into view, not
  // just ring it. Done during render (once per linked unit) rather than in an
  // effect, so the panel is open on the first paint that can show it.
  const [handledLinkUnitId, setHandledLinkUnitId] = useState(null);
  if (linkedUnitId && linkedUnitId !== handledLinkUnitId) {
    setHandledLinkUnitId(linkedUnitId);
    openUnit(linkedUnitId);
    setFocusRequest({ unitId: linkedUnitId, nonce: `link:${linkedUnitId}` });
  }

  const currentMapId = currentFloorMap?._id;
  const unitsOnMap = useMemo(
    () => storageUnits.filter((unit) => unit.floorMapId === currentMapId),
    [storageUnits, currentMapId],
  );
  const unitMaps = useMemo(
    () => buildUnitMaps(storageUnits, visibleMaps, visibleSites),
    [storageUnits, visibleMaps, visibleSites],
  );
  const selectedUnit = unitsOnMap.find((unit) => unit._id === selectedUnitId) ?? null;

  useEffect(() => {
    if (locationsReady && currentFloorMap && currentFloorMap._id !== selectedFloorMapId) {
      window.localStorage.setItem(STORAGE_KEY, currentFloorMap._id);
    }
  }, [locationsReady, currentFloorMap, selectedFloorMapId]);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  function chooseMap(mapId) {
    if (!visibleMaps.some((map) => map._id === mapId)) return;
    setSelectedFloorMapId(mapId);
    setSelectedUnitId(null);
    setHighlightedUnitId(null);
    window.localStorage.setItem(STORAGE_KEY, mapId);
    if (requestedMapId || requestedUnitId) setSearchParams({}, { replace: true });
  }

  function openUnit(unitId, shelfName = null) {
    setSelectedUnitId(unitId);
    setFocusShelfName(shelfName);
    setFocusNonce((n) => n + 1);
  }

  /**
   * Pan to the unit holding a search hit, flash it, and open its shelf -
   * switching to that unit's map first when it is on another one.
   */
  function handleShowOnMap(placement) {
    const target = unitMaps.get(placement.unitId);
    if (!target) return;
    // chooseMap clears the selection, so it runs before the unit is opened.
    if (target.floorMapId !== currentMapId) chooseMap(target.floorMapId);
    openUnit(placement.unitId, placement.shelfName);
    setFocusRequest({ unitId: placement.unitId, nonce: Date.now() });

    setHighlightedUnitId(placement.unitId);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedUnitId(null), HIGHLIGHT_MS);
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
          <div className="cfm-heading-tools">
            <CustomerMapSearch
              products={products}
              placements={placements}
              currentMapId={currentMapId}
              unitMaps={unitMaps}
              loading={loadState === "loading"}
              loadFailed={loadState === "error"}
              onShowOnMap={handleShowOnMap}
            />
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
            <button
              type="button"
              className="floor-map-button"
              onClick={() => canvasRef.current?.exportPng()}
            >
              Export as PNG
            </button>
          </div>
        )}
      </header>

      <div className="cfm-body">
        <div className="floor-map-viewport customer-floor-map-viewport">
          {!locationsReady ? (
            <MapState loading title="Loading floor maps…" />
          ) : !currentFloorMap ? (
            <MapState
              title="No public floor maps yet"
              description="There is no map available for this location right now."
            />
          ) : (
            <>
              <EditorProvider
                key={currentFloorMap._id}
                floorMapId={currentFloorMap._id}
                publicOrgCode={orgCode}
                isCanvasEditMode={false}
                setCanvasEditMode={() => {}}
              >
                <Canvas
                  ref={canvasRef}
                  isCanvasEditMode={false}
                  publicView
                  setSelectedStorageUnitId={(unitId) => openUnit(unitId)}
                  highlightedUnitId={highlightedUnitId ?? linkedUnitId}
                  focusRequest={focusRequest}
                />
              </EditorProvider>
              {!selectedUnit && (
                <p className="cfm-hint">Tap a storage unit to see what&apos;s inside.</p>
              )}
            </>
          )}
        </div>

        {selectedUnit && (
          <CustomerUnitPanel
            unitId={selectedUnit._id}
            unitName={selectedUnit.name}
            placements={placements}
            loading={loadState === "loading"}
            loadFailed={loadState === "error"}
            focusShelfName={focusShelfName}
            focusNonce={focusNonce}
            onClose={() => setSelectedUnitId(null)}
          />
        )}
      </div>
    </section>
  );
}
