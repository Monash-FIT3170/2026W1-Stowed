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
  "locationCode",
  "site",
  "floorMap",
  "storageUnit",
  "storageUnitType",
  "storageLocation",
];

function blankIfMissing(value) {
  return value ?? "";
}

export function buildLocationRows({
  storageLocations = [],
  storageUnits = [],
  floorMaps = [],
  sites = [],
}) {
  const unitById = new Map(storageUnits.map((u) => [u._id, u]));
  const floorMapById = new Map(floorMaps.map((f) => [f._id, f]));
  const siteById = new Map(sites.map((s) => [s._id, s]));

  return storageLocations.map((location) => {
    const unit = unitById.get(location.storageUnitId);
    const floorMap = unit ? floorMapById.get(unit.floorMapId) : null;
    const site = floorMap ? siteById.get(floorMap.siteId) : null;

    return {
      locationCode: blankIfMissing(location.code),
      site: blankIfMissing(site?.name),
      floorMap: blankIfMissing(floorMap?.name),
      storageUnit: blankIfMissing(unit?.name),
      storageUnitType: blankIfMissing(unit?.type),
      storageLocation: blankIfMissing(location.name),
    };
  });
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
      reorderAt: product.reorderAt ?? "",
      unitCost: product.unitCost ?? "",
      purchaseCost: product.purchaseCost ?? "",
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
