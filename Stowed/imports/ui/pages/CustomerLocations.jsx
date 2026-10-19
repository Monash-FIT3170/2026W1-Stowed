import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  buildFloorMapPreviewModel,
  FloorMapPreview,
} from "./floorMapComponents/canvas/components/FloorMapPreview";
import { publicMaps } from "./floorMapComponents/mapSelection";

/** Joins customer location labels to the already published public map geometry. */
export function CustomerLocations({ locations, floorMaps, storageUnits, sites, mapsReady }) {
  const rows = useMemo(() => {
    if (!mapsReady) return locations.map((location) => ({ location, model: null }));

    const mapsById = new Map(publicMaps(floorMaps).map((map) => [map._id, map]));
    const unitsById = new Map(storageUnits.map((unit) => [unit._id, unit]));
    const sitesById = new Map(sites.map((site) => [site._id, site]));
    const modelsById = new Map();

    return locations.map((location) => {
      const unit = unitsById.get(location.unitId);
      const floorMap = mapsById.get(unit?.floorMapId);
      if (!floorMap) return { location, model: null };
      if (!modelsById.has(floorMap._id)) {
        modelsById.set(floorMap._id, buildFloorMapPreviewModel(floorMap, storageUnits));
      }
      const model = modelsById.get(floorMap._id);
      return {
        location,
        floorMap,
        site: sitesById.get(floorMap.siteId),
        model: model?.units.some((candidate) => candidate.id === unit._id) ? model : null,
      };
    });
  }, [locations, floorMaps, storageUnits, sites, mapsReady]);

  const firstMappedIndex = rows.findIndex((row) => row.model);

  return (
    <ul className="customer-detail-locations">
      {rows.map(({ location, floorMap, site, model }, index) => (
        <li
          key={`${location.unitId ?? "unknown"}-${location.label}-${index}`}
          className="customer-detail-location"
        >
          {model ? (
            <details className="customer-detail-map-disclosure" open={index === firstMappedIndex}>
              <summary className="customer-detail-location-summary">
                <LocationHeading
                  location={location}
                  index={index}
                  count={rows.length}
                  floorMap={floorMap}
                  site={site}
                />
                <span className="customer-detail-map-toggle">
                  <span className="customer-detail-map-closed">Show map</span>
                  <span className="customer-detail-map-open">Hide map</span>
                  <span className="customer-detail-map-chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </summary>
              <FloorMapPreview
                model={model}
                highlightedUnitId={location.unitId}
                locationName={location.label}
              />
              <Link
                className="customer-detail-map-link"
                to={`/customer/floor-map?map=${encodeURIComponent(floorMap._id)}&unit=${encodeURIComponent(location.unitId)}`}
                aria-label={`Open ${location.label} on ${floorMap.name} floor map`}
              >
                Open in floor map →
              </Link>
            </details>
          ) : (
            <div className="customer-detail-location-unmapped">
              <div className="customer-detail-location-summary">
                <LocationHeading location={location} index={index} count={rows.length} />
              </div>
              {mapsReady && (
                <p className="customer-detail-map-unavailable">
                  Map preview unavailable for this location.
                </p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function LocationHeading({ location, index, count, floorMap, site }) {
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="customer-detail-pin">
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
      </svg>
      <span className="customer-detail-location-text">
        <span className="customer-detail-location-label">{location.label}</span>
        {floorMap && (
          <span className="customer-detail-location-floor">
            {[site?.name, floorMap.name].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      {index === 0 && count > 1 && (
        <span className="customer-detail-location-tag">Best place to look</span>
      )}
    </>
  );
}
