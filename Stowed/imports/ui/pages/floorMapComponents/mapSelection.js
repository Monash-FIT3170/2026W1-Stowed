export function publicMaps(floorMaps) {
  return floorMaps.filter((map) => map.isPrivate !== true);
}

export function selectAvailableMap(floorMaps, preferredId) {
  return floorMaps.find((map) => map._id === preferredId) ?? floorMaps[0] ?? null;
}

export const DEFAULT_SITE_NAME = "Dandenong Distribution Centre";

export function selectDefaultMap(
  floorMaps,
  sites,
  preferredId,
  defaultSiteName = DEFAULT_SITE_NAME,
) {
  const preferred = floorMaps.find((map) => map._id === preferredId);
  if (preferred) return preferred;
  const defaultSite = sites.find((site) => site.name === defaultSiteName);
  return (
    (defaultSite && floorMaps.find((map) => map.siteId === defaultSite._id)) ?? floorMaps[0] ?? null
  );
}

export function firstMapForSite(floorMaps, siteId) {
  return floorMaps.find((map) => map.siteId === siteId) ?? null;
}
