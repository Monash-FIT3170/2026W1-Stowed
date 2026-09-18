import assert from "assert";
import { Meteor } from "meteor/meteor";
import { describeServer } from "./serverOnly";
import { Products } from "../imports/api/products/collections";
import { StorageUnits, FloorMaps, Sites } from "../imports/api/locations/collections";
import { getBarcodeValue, buildUnitQrUrl } from "../imports/api/products/codes";
import { Organisations } from "../imports/api/organisations";
import "../imports/api/products/methods";
import "../imports/api/locations/methods";

const TEST_USER_ID = "test-user-id-codegen";
const TEST_ORG_ID = "test-org-id-codegen";
const OTHER_ORG_ID = "test-other-org-codegen";
const TEST_SITE_ID = "test-site-id-codegen";
const TEST_FLOOR_MAP_ID = "test-floor-map-id-codegen";
const TEST_ROLE = 2;

const UNIT_SHAPE = {
  orgId: TEST_ORG_ID,
  shapeId: 0,
  name: "dummy-shape-codegen",
  points: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ],
  gridReference: { x: 0, y: 0 },
};

function callMethod(name, params) {
  return new Promise((resolve, reject) => {
    const method = Meteor.server.method_handlers[name];
    try {
      Promise.resolve(method.call({ userId: TEST_USER_ID }, params))
        .then(resolve)
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

function makeUnit(id, overrides = {}) {
  const now = new Date();
  return {
    _id: id,
    orgId: TEST_ORG_ID,
    floorMapId: TEST_FLOOR_MAP_ID,
    name: id,
    type: "shelf",
    shape: UNIT_SHAPE,
    offset: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function makeProduct(id, overrides = {}) {
  const now = new Date();
  return Products.insertAsync({
    _id: id,
    orgId: TEST_ORG_ID,
    name: id,
    totalQuantity: 5,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describeServer("products.bulkGenerateCodes", function () {
  before(async function () {
    await cleanup();
    const now = new Date();
    await Organisations.insertAsync({
      _id: TEST_ORG_ID,
      name: "Codegen Org",
      code: "codegenorg",
      createdAt: now,
      updatedAt: now,
    });
    await Organisations.insertAsync({
      _id: OTHER_ORG_ID,
      name: "Other Codegen Org",
      code: "othercodegenorg",
      createdAt: now,
      updatedAt: now,
    });
    await Meteor.users.insertAsync({
      _id: TEST_USER_ID,
      username: "codegenorg~tester",
      emails: [{ address: "codegen@test.com", verified: true }],
      profile: { organisationId: TEST_ORG_ID, role: TEST_ROLE, username: "tester" },
    });
  });

  after(cleanup);

  afterEach(async function () {
    await Products.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
  });

  async function cleanup() {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Organisations.removeAsync({ _id: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
    await Products.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
  }

  it("assigns a fresh SKU to every code-less product", async function () {
    await makeProduct("p-blank-1");
    await makeProduct("p-blank-2");

    const result = await callMethod("products.bulkGenerateCodes", {
      productIds: ["p-blank-1", "p-blank-2"],
    });

    assert.strictEqual(result.updated, 2);
    for (const id of ["p-blank-1", "p-blank-2"]) {
      const product = await Products.findOneAsync(id);
      assert.ok(/^SKU-[0-9A-Z]{1,6}$/.test(product.sku), `bad sku: ${product.sku}`);
      assert.strictEqual(getBarcodeValue(product), product.sku);
    }
  });

  it("leaves a product that already has a SKU untouched and marks it skipped", async function () {
    await makeProduct("p-has-sku", { sku: "EXISTING-1" });

    const result = await callMethod("products.bulkGenerateCodes", {
      productIds: ["p-has-sku"],
    });

    assert.strictEqual(result.updated, 0);
    assert.deepStrictEqual(result.results, [
      { productId: "p-has-sku", sku: "EXISTING-1", skipped: true },
    ]);
    const product = await Products.findOneAsync("p-has-sku");
    assert.strictEqual(product.sku, "EXISTING-1");
  });

  it("generates unique SKUs within a single call", async function () {
    await makeProduct("p-u-1");
    await makeProduct("p-u-2");
    await makeProduct("p-u-3");

    await callMethod("products.bulkGenerateCodes", { productIds: ["p-u-1", "p-u-2", "p-u-3"] });

    const skus = (
      await Products.find({ _id: { $in: ["p-u-1", "p-u-2", "p-u-3"] } }).fetchAsync()
    ).map((p) => p.sku);
    assert.strictEqual(new Set(skus).size, 3);
  });

  it("ignores ids that belong to another organisation", async function () {
    const foreignId = await Products.insertAsync({
      orgId: OTHER_ORG_ID,
      name: "Foreign product",
      totalQuantity: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await callMethod("products.bulkGenerateCodes", { productIds: [foreignId] });

    assert.strictEqual(result.updated, 0);
    assert.deepStrictEqual(result.results, []);
    const foreign = await Products.findOneAsync(foreignId);
    assert.strictEqual(foreign.sku, undefined);
  });

  it("rejects a caller who is not logged in", async function () {
    const method = Meteor.server.method_handlers["products.bulkGenerateCodes"];
    await assert.rejects(
      () => Promise.resolve(method.call({ userId: null }, { productIds: [] })),
      /logged in/,
    );
  });
});

describeServer("storageUnits.bulkGenerateCodes", function () {
  before(async function () {
    await cleanup();
    const now = new Date();
    await Organisations.insertAsync({
      _id: TEST_ORG_ID,
      name: "Codegen Org",
      code: "codegenorg-units",
      createdAt: now,
      updatedAt: now,
    });
    await Organisations.insertAsync({
      _id: OTHER_ORG_ID,
      name: "Other Codegen Org",
      code: "othercodegenorg-units",
      createdAt: now,
      updatedAt: now,
    });
    await Meteor.users.insertAsync({
      _id: TEST_USER_ID,
      username: "codegenorg~tester-units",
      emails: [{ address: "codegen-units@test.com", verified: true }],
      profile: { organisationId: TEST_ORG_ID, role: TEST_ROLE, username: "tester" },
    });
    await Sites.insertAsync({
      _id: TEST_SITE_ID,
      orgId: TEST_ORG_ID,
      name: "Codegen Site",
      description: "",
      createdAt: now,
      updatedAt: now,
    });
    await FloorMaps.insertAsync({
      _id: TEST_FLOOR_MAP_ID,
      orgId: TEST_ORG_ID,
      siteId: TEST_SITE_ID,
      name: "Codegen Map",
      createdAt: now,
      updatedAt: now,
    });
  });

  after(cleanup);

  afterEach(async function () {
    await StorageUnits.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
  });

  async function cleanup() {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Organisations.removeAsync({ _id: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
    await Sites.removeAsync(TEST_SITE_ID);
    await FloorMaps.removeAsync(TEST_FLOOR_MAP_ID);
    await StorageUnits.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
  }

  it("marks each selected unit as having a generated QR code", async function () {
    await StorageUnits.insertAsync(makeUnit("u-1"));
    await StorageUnits.insertAsync(makeUnit("u-2"));

    const result = await callMethod("storageUnits.bulkGenerateCodes", { unitIds: ["u-1", "u-2"] });

    assert.strictEqual(result.updated, 2);
    for (const id of ["u-1", "u-2"]) {
      const unit = await StorageUnits.findOneAsync(id);
      assert.strictEqual(unit.qrGenerated, true);
    }
  });

  it("skips a unit whose QR code was already generated", async function () {
    await StorageUnits.insertAsync(makeUnit("u-done", { qrGenerated: true }));

    const result = await callMethod("storageUnits.bulkGenerateCodes", { unitIds: ["u-done"] });

    assert.strictEqual(result.updated, 0);
    assert.deepStrictEqual(result.results, [{ unitId: "u-done", skipped: true }]);
  });

  it("does not touch units belonging to another organisation", async function () {
    await StorageUnits.insertAsync(
      makeUnit("u-foreign", { orgId: OTHER_ORG_ID, shape: { ...UNIT_SHAPE, orgId: OTHER_ORG_ID } }),
    );

    const result = await callMethod("storageUnits.bulkGenerateCodes", { unitIds: ["u-foreign"] });

    assert.strictEqual(result.updated, 0);
    const unit = await StorageUnits.findOneAsync("u-foreign");
    assert.notStrictEqual(unit.qrGenerated, true);
  });

  it("encodes the unit's detail page in the QR value", function () {
    assert.strictEqual(
      buildUnitQrUrl("https://stowed.example.com", "u-1"),
      "https://stowed.example.com/locations/unit/u-1",
    );
  });
});
