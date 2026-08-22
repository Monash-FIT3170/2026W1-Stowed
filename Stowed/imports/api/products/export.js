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
      floorWidth: blankIfMissing(floorMap?.floorSize?.width),
      floorHeight: blankIfMissing(floorMap?.floorSize?.height),
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

export function buildExport(data) {
  return {
    locations: buildLocationRows(data),
    inventory: buildInventoryRows(data),
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
