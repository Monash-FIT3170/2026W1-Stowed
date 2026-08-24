import assert from "assert";
import { Meteor } from "meteor/meteor";
import { Products, ProductRecords } from "../imports/api/products/collections";
import { Organisations } from "../imports/api/organisations";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "../imports/api/locations/collections";
import "../imports/api/products/methods";

const TEST_USER_ID = "test-user-id-stock-adjust";
const TEST_ORG_ID = "test-org-id-stock-adjust";
const OTHER_ORG_ID = "test-other-org-stock-adjust";
const TEST_SITE_ID = "test-site-id-stock-adjust";
const OTHER_SITE_ID = "test-other-site-stock-adjust";
const TEST_FLOOR_MAP_ID = "test-floor-map-id-stock-adjust";
const OTHER_FLOOR_MAP_ID = "test-other-floor-map-stock-adjust";
const TEST_STORAGE_UNIT_ID = "test-unit-id-stock-adjust";
const OTHER_STORAGE_UNIT_ID = "test-other-unit-stock-adjust";
const LOCATION_A = "loc-a-stock-adjust";
const LOCATION_B = "loc-b-stock-adjust";
const OTHER_ORG_LOCATION = "loc-other-org-stock-adjust";
const TEST_ROLE = 1; // STANDARD — the scan flow must work for regular staff

describe("Stock adjust methods (scan-driven stocktake)", function () {
  before(async function () {
    await cleanup();

    const now = new Date();
    await Organisations.insertAsync({
      _id: TEST_ORG_ID,
      name: "Stock Adjust Org",
      code: "stockadjust",
      createdAt: now,
      updatedAt: now,
    });
    await Organisations.insertAsync({
      _id: OTHER_ORG_ID,
      name: "Other Org",
      code: "otherorg-stockadjust",
      createdAt: now,
      updatedAt: now,
    });

    await Meteor.users.insertAsync({
      _id: TEST_USER_ID,
      username: "stockadjust~tester",
      emails: [{ address: "stock-adjust@test.com", verified: true }],
      profile: { organisationId: TEST_ORG_ID, role: TEST_ROLE, username: "tester" },
    });

    for (const [siteId, floorMapId, unitId, locationIds, orgId] of [
      [
        TEST_SITE_ID,
        TEST_FLOOR_MAP_ID,
        TEST_STORAGE_UNIT_ID,
        [LOCATION_A, LOCATION_B],
        TEST_ORG_ID,
      ],
      [
        OTHER_SITE_ID,
        OTHER_FLOOR_MAP_ID,
        OTHER_STORAGE_UNIT_ID,
        [OTHER_ORG_LOCATION],
        OTHER_ORG_ID,
      ],
    ]) {
      await Sites.insertAsync({
        _id: siteId,
        orgId,
        name: "Site",
        description: "",
        createdAt: now,
        updatedAt: now,
      });
      await FloorMaps.insertAsync({
        _id: floorMapId,
        orgId,
        siteId,
        name: "Map",
        createdAt: now,
        updatedAt: now,
      });
      await StorageUnits.insertAsync({
        _id: unitId,
        orgId,
        floorMapId,
        name: "Unit",
        type: "shelf",
        position: { x: 0, y: 0, width: 1, height: 1 },
        createdAt: now,
        updatedAt: now,
      });
      for (const locationId of locationIds) {
        await StorageLocations.insertAsync({
          _id: locationId,
          orgId,
          storageUnitId: unitId,
          name: locationId,
          storedItems: [],
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  });

  after(cleanup);

  async function cleanup() {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Organisations.removeAsync({ _id: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
    await Sites.removeAsync({ _id: { $in: [TEST_SITE_ID, OTHER_SITE_ID] } });
    await FloorMaps.removeAsync({ _id: { $in: [TEST_FLOOR_MAP_ID, OTHER_FLOOR_MAP_ID] } });
    await StorageUnits.removeAsync({ _id: { $in: [TEST_STORAGE_UNIT_ID, OTHER_STORAGE_UNIT_ID] } });
    await StorageLocations.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
    await Products.removeAsync({ orgId: TEST_ORG_ID });
  }

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

  async function seedProduct({ a = 10, b = 5 } = {}) {
    const now = new Date();
    const productId = await Products.insertAsync({
      orgId: TEST_ORG_ID,
      name: "Test Widget",
      sku: "WID-1",
      totalQuantity: a + b,
      createdAt: now,
      updatedAt: now,
    });
    await ProductRecords.insertAsync({
      productId,
      locationId: LOCATION_A,
      quantity: a,
      createdAt: now,
      updatedAt: now,
    });
    await ProductRecords.insertAsync({
      productId,
      locationId: LOCATION_B,
      quantity: b,
      createdAt: now,
      updatedAt: now,
    });
    return productId;
  }

  async function sumRecords(productId) {
    const records = await ProductRecords.find({ productId }).fetchAsync();
    return records.reduce((s, r) => s + r.quantity, 0);
  }

  afterEach(async function () {
    const products = await Products.find({ orgId: TEST_ORG_ID }).fetchAsync();
    for (const p of products) await ProductRecords.removeAsync({ productId: p._id });
    await Products.removeAsync({ orgId: TEST_ORG_ID });
  });

  describe("products.adjustStock", function () {
    it("increases stock at a location and keeps the total in sync", async function () {
      const productId = await seedProduct();
      const result = await callMethod("products.adjustStock", {
        productId,
        locationId: LOCATION_A,
        delta: 3,
      });
      assert.strictEqual(result.effectiveDelta, 3);
      assert.strictEqual(result.newQuantity, 13);
      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 18);
      assert.strictEqual(await sumRecords(productId), 18);
    });

    it("decreases stock at a location", async function () {
      const productId = await seedProduct();
      const result = await callMethod("products.adjustStock", {
        productId,
        locationId: LOCATION_B,
        delta: -2,
      });
      assert.strictEqual(result.newQuantity, 3);
      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 13);
    });

    it("clamps at zero and reports the effective delta", async function () {
      const productId = await seedProduct({ a: 4, b: 5 });
      const result = await callMethod("products.adjustStock", {
        productId,
        locationId: LOCATION_A,
        delta: -99,
      });
      assert.strictEqual(result.newQuantity, 0);
      assert.strictEqual(result.effectiveDelta, -4);
      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 5);
    });

    it("creates the record when adding stock to a location the product is not in yet", async function () {
      const productId = await seedProduct({ a: 10, b: 0 });
      await ProductRecords.removeAsync({ productId, locationId: LOCATION_B });
      const result = await callMethod("products.adjustStock", {
        productId,
        locationId: LOCATION_B,
        delta: 7,
      });
      assert.strictEqual(result.newQuantity, 7);
      const record = await ProductRecords.findOneAsync({ productId, locationId: LOCATION_B });
      assert.ok(record);
      assert.strictEqual(record.quantity, 7);
      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 17);
    });

    it("rejects removing stock from a location the product is not in", async function () {
      const productId = await seedProduct();
      await ProductRecords.removeAsync({ productId, locationId: LOCATION_B });
      await assert.rejects(
        callMethod("products.adjustStock", { productId, locationId: LOCATION_B, delta: -1 }),
        (err) => err.error === "no-stock-at-location",
      );
    });

    it("rejects a zero delta", async function () {
      const productId = await seedProduct();
      await assert.rejects(
        callMethod("products.adjustStock", { productId, locationId: LOCATION_A, delta: 0 }),
        (err) => err.error === "invalid-quantity",
      );
    });

    it("rejects a location belonging to another organisation", async function () {
      const productId = await seedProduct();
      await assert.rejects(
        callMethod("products.adjustStock", { productId, locationId: OTHER_ORG_LOCATION, delta: 1 }),
        (err) => err.error === "forbidden",
      );
    });
  });

  describe("products.setStock", function () {
    it("sets the exact counted quantity and re-syncs the total", async function () {
      const productId = await seedProduct();
      const result = await callMethod("products.setStock", {
        productId,
        locationId: LOCATION_A,
        quantity: 47,
      });
      assert.strictEqual(result.newQuantity, 47);
      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 52);
      assert.strictEqual(await sumRecords(productId), 52);
    });

    it("can set a location to zero", async function () {
      const productId = await seedProduct();
      await callMethod("products.setStock", { productId, locationId: LOCATION_A, quantity: 0 });
      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 5);
    });

    it("rejects a negative quantity", async function () {
      const productId = await seedProduct();
      await assert.rejects(
        callMethod("products.setStock", { productId, locationId: LOCATION_A, quantity: -1 }),
        (err) => err.error === "invalid-quantity",
      );
    });
  });
});
