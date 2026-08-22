import assert from "assert";
import {
  buildLocationRows,
  buildInventoryRows,
  buildExport,
  toCsv,
  INVENTORY_COLUMNS,
  LOCATION_COLUMNS,
} from "../imports/api/products/export";

const SITES = [{ _id: "site-1", name: "Clayton Campus" }];

const FLOOR_MAPS = [{ _id: "floor-1", siteId: "site-1", name: "Building 18" }];

const STORAGE_UNITS = [
  { _id: "unit-1", floorMapId: "floor-1", name: "Cabinet A", type: "cabinet" },
];

const STORAGE_LOCATIONS = [
  { _id: "loc-1", storageUnitId: "unit-1", name: "Shelf 1", code: "SC-A1" },
  { _id: "loc-2", storageUnitId: "unit-1", name: "Shelf 2", code: "SC-A2" },
];

const CATEGORIES = [{ _id: "cat-1", name: "Lab Safety" }];

const PRODUCTS = [
  {
    _id: "prod-1",
    name: "Lab Safety Goggles",
    sku: "PPE-GOG-001",
    brand: "3M",
    categoryId: "cat-1",
    description: "Splash goggles",
    totalQuantity: 60,
    reorderAt: 15,
    unitCost: 12.5,
    purchaseCost: 7.2,
  },
];

const PRODUCT_RECORDS = [
  { productId: "prod-1", locationId: "loc-1", quantity: 35 },
  { productId: "prod-1", locationId: "loc-2", quantity: 25 },
];

const FIXTURE = {
  products: PRODUCTS,
  productRecords: PRODUCT_RECORDS,
  storageLocations: STORAGE_LOCATIONS,
  storageUnits: STORAGE_UNITS,
  floorMaps: FLOOR_MAPS,
  sites: SITES,
  categories: CATEGORIES,
};

describe("export - buildLocationRows", function () {
  it("returns one row per storage location", function () {
    const rows = buildLocationRows(FIXTURE);
    assert.strictEqual(rows.length, 2);
  });

  it("resolves the full hierarchy onto each row", function () {
    const [row] = buildLocationRows(FIXTURE);
    assert.strictEqual(row.locationCode, "SC-A1");
    assert.strictEqual(row.site, "Clayton Campus");
    assert.strictEqual(row.floorMap, "Building 18");
    assert.strictEqual(row.storageUnit, "Cabinet A");
    assert.strictEqual(row.storageUnitType, "cabinet");
    assert.strictEqual(row.storageLocation, "Shelf 1");
  });

  it("blanks hierarchy fields when a parent is missing", function () {
    const rows = buildLocationRows({
      ...FIXTURE,
      storageUnits: [],
      floorMaps: [],
      sites: [],
    });
    assert.strictEqual(rows[0].site, "");
    assert.strictEqual(rows[0].storageUnit, "");
    assert.strictEqual(rows[0].locationCode, "SC-A1");
  });

  it("returns an empty array when there are no locations", function () {
    assert.deepStrictEqual(buildLocationRows({}), []);
  });

  it("emits a blank-location row for a unit with no locations", function () {
    const rows = buildLocationRows({ ...FIXTURE, storageLocations: [] });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].storageUnit, "Cabinet A");
    assert.strictEqual(rows[0].locationCode, "");
  });

  it("includes unit geometry columns", function () {
    const rows = buildLocationRows({
      ...FIXTURE,
      storageUnits: [
        { ...STORAGE_UNITS[0], offset: { x: 1, y: 2 }, rotation: 0, scale: { x: 1, y: 1 } },
      ],
    });
    assert.strictEqual(rows[0].unitOffsetX, 1);
    assert.strictEqual(rows[0].unitOffsetY, 2);
  });
});

describe("export - buildInventoryRows", function () {
  it("returns one row per product-location pair", function () {
    const rows = buildInventoryRows(FIXTURE);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(
      rows.map((r) => r.locationCode),
      ["SC-A1", "SC-A2"],
    );
    assert.deepStrictEqual(
      rows.map((r) => r.quantityAtLocation),
      [35, 25],
    );
  });

  it("repeats product details across each of its rows", function () {
    const rows = buildInventoryRows(FIXTURE);
    for (const row of rows) {
      assert.strictEqual(row.name, "Lab Safety Goggles");
      assert.strictEqual(row.sku, "PPE-GOG-001");
      assert.strictEqual(row.totalQuantity, 60);
    }
  });

  it("resolves the category name from categoryId", function () {
    const [row] = buildInventoryRows(FIXTURE);
    assert.strictEqual(row.category, "Lab Safety");
  });

  it("blanks the category when the id does not resolve", function () {
    const rows = buildInventoryRows({ ...FIXTURE, categories: [] });
    assert.strictEqual(rows[0].category, "");
  });

  it("emits one blank-location row for a product with no records", function () {
    const rows = buildInventoryRows({ ...FIXTURE, productRecords: [] });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].locationCode, "");
    assert.strictEqual(rows[0].quantityAtLocation, 0);
    assert.strictEqual(rows[0].name, "Lab Safety Goggles");
  });

  it("blanks optional numeric fields rather than emitting null", function () {
    const rows = buildInventoryRows({
      ...FIXTURE,
      products: [{ _id: "prod-2", name: "Bare Product", totalQuantity: 0 }],
      productRecords: [],
    });
    assert.strictEqual(rows[0].reorderAt, "");
    assert.strictEqual(rows[0].unitCost, "");
    assert.strictEqual(rows[0].purchaseCost, "");
  });

  it("never emits undefined for any column", function () {
    const rows = buildInventoryRows({
      ...FIXTURE,
      products: [{ _id: "prod-2", name: "Bare Product", totalQuantity: 0 }],
      productRecords: [],
    });
    for (const column of INVENTORY_COLUMNS) {
      assert.notStrictEqual(rows[0][column], undefined, `${column} must not be undefined`);
    }
  });

  it("returns an empty array when there are no products", function () {
    assert.deepStrictEqual(buildInventoryRows({}), []);
  });
});

describe("export - buildExport", function () {
  it("returns both tables", function () {
    const result = buildExport(FIXTURE);
    assert.strictEqual(result.locations.length, 2);
    assert.strictEqual(result.inventory.length, 2);
  });

  it("only references location codes present in the locations table", function () {
    const { locations, inventory } = buildExport(FIXTURE);
    const known = new Set(locations.map((l) => l.locationCode));
    for (const row of inventory) {
      if (row.locationCode === "") continue;
      assert.ok(known.has(row.locationCode), `unknown code ${row.locationCode}`);
    }
  });
});

describe("export - toCsv", function () {
  it("writes a header row from the given columns", function () {
    const csv = toCsv([], LOCATION_COLUMNS);
    assert.strictEqual(csv, LOCATION_COLUMNS.join(","));
  });

  it("writes one line per row, CRLF separated", function () {
    const csv = toCsv(buildLocationRows(FIXTURE), LOCATION_COLUMNS);
    assert.strictEqual(csv.split("\r\n").length, 3);
  });

  it("quotes values containing a comma", function () {
    const csv = toCsv([{ name: "Widget, large" }], ["name"]);
    assert.ok(csv.includes('"Widget, large"'));
  });

  it("escapes embedded double quotes by doubling them", function () {
    const csv = toCsv([{ name: 'The "Big" One' }], ["name"]);
    assert.ok(csv.includes('"The ""Big"" One"'));
  });

  it("quotes values containing a line break", function () {
    const csv = toCsv([{ name: "line one\nline two" }], ["name"]);
    assert.ok(csv.includes('"line one\nline two"'));
  });

  it("writes an empty cell for a missing column", function () {
    const csv = toCsv([{ name: "Widget" }], ["name", "sku"]);
    assert.strictEqual(csv, "name,sku\r\nWidget,");
  });
});
