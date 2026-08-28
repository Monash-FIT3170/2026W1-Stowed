export const INVENTORY_COLUMNS = [
  "name",
  "sku",
  "brand",
  "category",
  "locationCode",
  "quantityAtLocation",
  "totalQuantity",
  "reorderAt",
  "unitCost",
  "purchaseCost",
  "description",
];

export const LOCATION_COLUMNS = [
  "site",
  "siteDescription",
  "floorMap",
  "floorWidth",
  "floorHeight",
  "storageUnit",
  "storageUnitType",
  "unitOffsetX",
  "unitOffsetY",
  "unitRotation",
  "unitScaleX",
  "unitScaleY",
  "storageLocation",
  "locationCode",
];

const IMPORT_PIXELS_PER_METER = 50;

const EMPTY_UNIT = {
  site: "",
  siteDescription: "",
  floorMap: "",
  floorWidth: "",
  floorHeight: "",
  storageUnit: "",
  storageUnitType: "",
  unitOffsetX: "",
  unitOffsetY: "",
  unitRotation: "",
  unitScaleX: "",
  unitScaleY: "",
};

function blankIfMissing(value) {
  return value ?? "";
}

function toImportFloorMeters(value) {
  return typeof value === "number" ? value / IMPORT_PIXELS_PER_METER : "";
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : blankIfMissing(value);
}

function getShapeSize(unit) {
  const points = unit?.shape?.points;
  if (!Array.isArray(points) || points.length === 0) {
    return { width: "", height: "" };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function unassignedLocationCode(product) {
  return `UNASSIGNED-${product?._id || product?.sku || product?.name || "PRODUCT"}`.slice(0, 50);
}

function buildImportLocationFields({ location, unit, floorMap, site }) {
  const shapeSize = getShapeSize(unit);

  return {
    siteName: blankIfMissing(site?.name),
    floorMapName: blankIfMissing(floorMap?.name),
    floorMapWidth: toImportFloorMeters(floorMap?.floorSize?.width),
    floorMapHeight: toImportFloorMeters(floorMap?.floorSize?.height),
    storageUnitName: blankIfMissing(unit?.name),
    storageUnitType: blankIfMissing(unit?.type),
    storageUnitOffsetX: blankIfMissing(unit?.offset?.x),
    storageUnitOffsetY: blankIfMissing(unit?.offset?.y),
    storageUnitWidth: shapeSize.width,
    storageUnitHeight: shapeSize.height,
    locationName: blankIfMissing(location?.name),
    locationCode: blankIfMissing(location?.code),
    lastStocktakeAt: toIsoString(location?.lastStocktakeAt),
  };
}

function buildImportProductFields(product, categoryName, assignments, totalQuantity) {
  return {
    name: blankIfMissing(product?.name),
    description: blankIfMissing(product?.description),
    category: blankIfMissing(categoryName || product?.category),
    sku: blankIfMissing(product?.sku),
    brand: blankIfMissing(product?.brand),
    unitCost: blankIfMissing(product?.unitCost),
    totalQuantity: totalQuantity ?? product?.totalQuantity ?? 0,
    assignments,
    reorderAt: blankIfMissing(product?.reorderAt),
    qrCode: blankIfMissing(product?.qrCode),
  };
}

export function buildLocationRows({
  storageLocations = [],
  storageUnits = [],
  floorMaps = [],
  sites = [],
}) {
  const floorMapById = new Map(floorMaps.map((f) => [f._id, f]));
  const siteById = new Map(sites.map((s) => [s._id, s]));

  const locationsByUnitId = new Map();
  for (const location of storageLocations) {
    const existing = locationsByUnitId.get(location.storageUnitId) ?? [];
    existing.push(location);
    locationsByUnitId.set(location.storageUnitId, existing);
  }

  const rows = [];
  const placed = new Set();

  for (const unit of storageUnits) {
    const floorMap = floorMapById.get(unit.floorMapId);
    const site = floorMap ? siteById.get(floorMap.siteId) : null;

    const base = {
      site: blankIfMissing(site?.name),
      siteDescription: blankIfMissing(site?.description),
      floorMap: blankIfMissing(floorMap?.name),
      floorWidth: toImportFloorMeters(floorMap?.floorSize?.width),
      floorHeight: toImportFloorMeters(floorMap?.floorSize?.height),
      storageUnit: blankIfMissing(unit.name),
      storageUnitType: blankIfMissing(unit.type),
      unitOffsetX: blankIfMissing(unit.offset?.x),
      unitOffsetY: blankIfMissing(unit.offset?.y),
      unitRotation: blankIfMissing(unit.rotation),
      unitScaleX: blankIfMissing(unit.scale?.x),
      unitScaleY: blankIfMissing(unit.scale?.y),
    };

    const locations = locationsByUnitId.get(unit._id) ?? [];

    if (locations.length === 0) {
      rows.push({ ...base, storageLocation: "", locationCode: "" });
      continue;
    }

    for (const location of locations) {
      placed.add(location._id);
      rows.push({
        ...base,
        storageLocation: blankIfMissing(location.name),
        locationCode: blankIfMissing(location.code),
      });
    }
  }

  for (const location of storageLocations) {
    if (placed.has(location._id)) continue;
    rows.push({
      ...EMPTY_UNIT,
      storageLocation: blankIfMissing(location.name),
      locationCode: blankIfMissing(location.code),
    });
  }

  return rows;
}

export function buildInventoryRows({
  products = [],
  productRecords = [],
  storageLocations = [],
  categories = [],
}) {
  const categoryNameById = new Map(categories.map((c) => [c._id, c.name]));
  const codeByLocationId = new Map(storageLocations.map((l) => [l._id, l.code ?? ""]));

  const recordsByProductId = new Map();
  for (const record of productRecords) {
    const existing = recordsByProductId.get(record.productId) ?? [];
    existing.push(record);
    recordsByProductId.set(record.productId, existing);
  }

  const rows = [];

  for (const product of products) {
    const base = {
      name: blankIfMissing(product.name),
      sku: blankIfMissing(product.sku),
      brand: blankIfMissing(product.brand),
      category: blankIfMissing(categoryNameById.get(product.categoryId)),
      totalQuantity: product.totalQuantity ?? 0,
      reorderAt: blankIfMissing(product.reorderAt),
      unitCost: blankIfMissing(product.unitCost),
      purchaseCost: blankIfMissing(product.purchaseCost),
      description: blankIfMissing(product.description),
    };

    const records = recordsByProductId.get(product._id) ?? [];

    if (records.length === 0) {
      rows.push({ ...base, locationCode: "", quantityAtLocation: 0 });
      continue;
    }

    for (const record of records) {
      rows.push({
        ...base,
        locationCode: blankIfMissing(codeByLocationId.get(record.locationId)),
        quantityAtLocation: record.quantity ?? 0,
      });
    }
  }

  return rows;
}

export function buildImportRows({
  products = [],
  productRecords = [],
  storageLocations = [],
  storageUnits = [],
  floorMaps = [],
  sites = [],
  categories = [],
}) {
  const categoryNameById = new Map(categories.map((c) => [c._id, c.name]));
  const unitById = new Map(storageUnits.map((unit) => [unit._id, unit]));
  const floorMapById = new Map(floorMaps.map((floorMap) => [floorMap._id, floorMap]));
  const siteById = new Map(sites.map((site) => [site._id, site]));
  const locationById = new Map(storageLocations.map((location) => [location._id, location]));
  const productById = new Map(products.map((product) => [product._id, product]));
  const usedLocationIds = new Set();
  const usedProductIds = new Set();
  const usedUnitIds = new Set();

  function hierarchyForLocation(location) {
    const unit = location ? unitById.get(location.storageUnitId) : null;
    const floorMap = unit ? floorMapById.get(unit.floorMapId) : null;
    const site = floorMap ? siteById.get(floorMap.siteId) : null;
    if (unit) usedUnitIds.add(unit._id);
    return { location, unit, floorMap, site };
  }

  const rows = [];

  for (const record of productRecords) {
    const product = productById.get(record.productId);
    if (!product) continue;

    const location = locationById.get(record.locationId);
    const locationCode = location?.code ?? "";
    if (location) usedLocationIds.add(location._id);
    usedProductIds.add(product._id);

    rows.push({
      ...buildImportLocationFields(hierarchyForLocation(location)),
      ...buildImportProductFields(
        product,
        categoryNameById.get(product.categoryId),
        locationCode ? [{ locationCode, quantity: record.quantity ?? 0 }] : [],
        record.quantity ?? 0,
      ),
    });
  }

  for (const location of storageLocations) {
    if (usedLocationIds.has(location._id)) continue;
    rows.push({
      ...buildImportLocationFields(hierarchyForLocation(location)),
      ...buildImportProductFields(null, "", [], ""),
    });
  }

  for (const unit of storageUnits) {
    if (usedUnitIds.has(unit._id)) continue;
    const floorMap = floorMapById.get(unit.floorMapId);
    rows.push({
      ...buildImportLocationFields({
        location: null,
        unit,
        floorMap,
        site: floorMap ? siteById.get(floorMap.siteId) : null,
      }),
      ...buildImportProductFields(null, "", [], ""),
    });
  }

  for (const product of products) {
    if (usedProductIds.has(product._id)) continue;
    const hasUnassignedStock = (product.totalQuantity ?? 0) > 0;
    const locationCode = hasUnassignedStock ? unassignedLocationCode(product) : "";
    rows.push({
      ...buildImportLocationFields({
        location: hasUnassignedStock
          ? { name: "Unassigned Stock", code: locationCode, lastStocktakeAt: "" }
          : null,
        unit: hasUnassignedStock
          ? {
              name: "Unassigned Stock",
              type: "other",
              offset: { x: 0, y: 0 },
              shape: {
                points: [
                  { x: 0, y: 0 },
                  { x: 1, y: 0 },
                  { x: 1, y: 1 },
                  { x: 0, y: 1 },
                ],
              },
            }
          : null,
        floorMap: hasUnassignedStock
          ? { name: "Unassigned Stock", floorSize: { width: 500, height: 500 } }
          : null,
        site: hasUnassignedStock ? { name: "Unassigned Stock" } : null,
      }),
      ...buildImportProductFields(
        product,
        categoryNameById.get(product.categoryId),
        hasUnassignedStock ? [{ locationCode, quantity: product.totalQuantity ?? 0 }] : [],
        product.totalQuantity ?? 0,
      ),
    });
  }

  return rows;
}

export function buildExport(data) {
  return {
    locations: buildLocationRows(data),
    inventory: buildInventoryRows(data),
    importRows: buildImportRows(data),
  };
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(row[column])).join(","));
  }
  return lines.join("\r\n");
}
