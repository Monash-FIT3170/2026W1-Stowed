export function publicMaps(floorMaps) {
  return floorMaps.filter((map) => map.isPrivate !== true);
}

export function selectAvailableMap(floorMaps, preferredId) {
  return floorMaps.find((map) => map._id === preferredId) ?? floorMaps[0] ?? null;
}

export function firstMapForSite(floorMaps, siteId) {
  return floorMaps.find((map) => map.siteId === siteId) ?? null;
}
