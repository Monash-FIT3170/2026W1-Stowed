function byName(left, right) {
  return (
    (left.name ?? "").localeCompare(right.name ?? "", undefined, { sensitivity: "base" }) ||
    String(left._id).localeCompare(String(right._id))
  );
}

function groupByParent(records, parentKey) {
  const groups = new Map();
  for (const record of records) {
    const parentId = record[parentKey];
    if (!groups.has(parentId)) groups.set(parentId, []);
    groups.get(parentId).push(record);
  }
  for (const group of groups.values()) group.sort(byName);
  return groups;
}

export function buildLocationHierarchy(sites, floorMaps, storageUnits, storageLocations) {
  const floorMapsBySiteId = groupByParent(floorMaps, "siteId");
  const unitsByFloorMapId = groupByParent(storageUnits, "floorMapId");
  const locationsByUnitId = groupByParent(storageLocations, "storageUnitId");

  return [...sites].sort(byName).map((site) => {
    let unitCount = 0;
    let locationCount = 0;
    const floors = (floorMapsBySiteId.get(site._id) ?? []).map((floorMap) => {
      let floorLocationCount = 0;
      const units = (unitsByFloorMapId.get(floorMap._id) ?? []).map((unit) => {
        const locations = locationsByUnitId.get(unit._id) ?? [];
        floorLocationCount += locations.length;
        return { unit, locations, locationCount: locations.length };
      });
      unitCount += units.length;
      locationCount += floorLocationCount;
      return { floorMap, units, unitCount: units.length, locationCount: floorLocationCount };
    });
    return { site, floors, floorCount: floors.length, unitCount, locationCount };
  });
}
