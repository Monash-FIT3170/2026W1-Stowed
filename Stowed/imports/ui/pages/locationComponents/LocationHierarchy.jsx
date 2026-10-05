import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { buildLocationHierarchy } from "./buildLocationHierarchy";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function HierarchyBranch({
  level,
  id,
  name,
  summary,
  link,
  linkLabel,
  expanded,
  onToggle,
  children,
}) {
  const childId = `location-hierarchy-${level}-${id}`;
  return (
    <li className={`location-hierarchy-${level}`}>
      <div className="location-hierarchy-row">
        <button
          type="button"
          className="location-hierarchy-toggle"
          aria-expanded={expanded}
          aria-controls={childId}
          onClick={onToggle}
        >
          <span className="location-hierarchy-chevron" aria-hidden="true">
            ›
          </span>
          <span className="location-hierarchy-text">
            <span className="location-hierarchy-name">{name}</span>
            <span className="location-hierarchy-summary">{summary}</span>
          </span>
        </button>
        {link && (
          <Link className="location-hierarchy-action" to={link}>
            {linkLabel}
          </Link>
        )}
      </div>
      <ul id={childId} className="location-hierarchy-children" hidden={!expanded}>
        {expanded && children}
      </ul>
    </li>
  );
}

export function LocationHierarchy({ sites, floorMaps, storageUnits, storageLocations, loading }) {
  const hierarchy = useMemo(
    () => buildLocationHierarchy(sites, floorMaps, storageUnits, storageLocations),
    [sites, floorMaps, storageUnits, storageLocations],
  );
  const [expanded, setExpanded] = useState({ site: new Set(), floor: new Set(), unit: new Set() });

  function toggle(level, id) {
    setExpanded((current) => {
      const nextLevel = new Set(current[level]);
      if (nextLevel.has(id)) nextLevel.delete(id);
      else nextLevel.add(id);
      return { ...current, [level]: nextLevel };
    });
  }

  if (loading) return <div className="locations-empty">Loading location hierarchy…</div>;
  if (hierarchy.length === 0) {
    return (
      <div className="locations-empty location-hierarchy-empty">
        <strong>No location hierarchy yet.</strong>
        <span>
          Add a site and floor map to begin building your organisation’s physical structure.
        </span>
      </div>
    );
  }

  return (
    <section className="location-hierarchy" aria-label="Physical storage hierarchy">
      <ul className="location-hierarchy-list">
        {hierarchy.map(({ site, floors, floorCount, unitCount, locationCount }) => (
          <HierarchyBranch
            key={site._id}
            level="site"
            id={site._id}
            name={site.name}
            summary={`${plural(floorCount, "floor")} · ${plural(unitCount, "unit")} · ${plural(locationCount, "location")}`}
            expanded={expanded.site.has(site._id)}
            onToggle={() => toggle("site", site._id)}
          >
            {floors.length === 0 ? (
              <li className="location-hierarchy-child-empty">No floors in this site</li>
            ) : (
              floors.map(
                ({
                  floorMap,
                  units,
                  unitCount: floorUnitCount,
                  locationCount: floorLocationCount,
                }) => (
                  <HierarchyBranch
                    key={floorMap._id}
                    level="floor"
                    id={floorMap._id}
                    name={floorMap.name}
                    summary={`${plural(floorUnitCount, "unit")} · ${plural(floorLocationCount, "location")}`}
                    link={`/floor-map/${floorMap._id}`}
                    linkLabel="Open map"
                    expanded={expanded.floor.has(floorMap._id)}
                    onToggle={() => toggle("floor", floorMap._id)}
                  >
                    {units.length === 0 ? (
                      <li className="location-hierarchy-child-empty">
                        No storage units on this floor
                      </li>
                    ) : (
                      units.map(({ unit, locations, locationCount: unitLocationCount }) => (
                        <HierarchyBranch
                          key={unit._id}
                          level="unit"
                          id={unit._id}
                          name={unit.name}
                          summary={plural(unitLocationCount, "location")}
                          link={`/locations/unit/${unit._id}`}
                          linkLabel="View unit"
                          expanded={expanded.unit.has(unit._id)}
                          onToggle={() => toggle("unit", unit._id)}
                        >
                          {locations.length === 0 ? (
                            <li className="location-hierarchy-child-empty">
                              No storage locations in this unit
                            </li>
                          ) : (
                            locations.map((location) => (
                              <li className="location-hierarchy-location" key={location._id}>
                                <div className="location-hierarchy-row">
                                  <span
                                    className="location-hierarchy-leaf-marker"
                                    aria-hidden="true"
                                  />
                                  <span className="location-hierarchy-text">
                                    <Link
                                      className="location-hierarchy-name"
                                      to={`/locations/${location._id}`}
                                    >
                                      {location.name || "Unnamed location"}
                                    </Link>
                                    {location.code && (
                                      <span className="location-hierarchy-code">
                                        {location.code}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </li>
                            ))
                          )}
                        </HierarchyBranch>
                      ))
                    )}
                  </HierarchyBranch>
                ),
              )
            )}
          </HierarchyBranch>
        ))}
      </ul>
    </section>
  );
}
