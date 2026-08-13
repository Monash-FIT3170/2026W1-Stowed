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

const TEST_USER_ID = "test-user-id-products";
const TEST_ORG_ID = "test-org-id-products";
const TEST_SITE_ID = "test-site-id-products";
const TEST_FLOOR_MAP_ID = "test-floor-map-id-products";
const TEST_STORAGE_UNIT_ID = "test-storage-unit-id-products";
const TEST_LOCATION_ID = "loc-1-products";
const TEST_ROLE = 3;

const UNIT_SHAPE = {
  orgId: TEST_ORG_ID,
  shapeId: 0,
  name: "dummy-shape-products",
  points: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ],
  gridReference: { x: 0, y: 0 },
};

const STORAGE_UNIT = {
  _id: TEST_STORAGE_UNIT_ID,
  orgId: TEST_ORG_ID,
  floorMapId: TEST_FLOOR_MAP_ID,
  name: "Test Storage Unit",
  type: "shelf",
  shape: UNIT_SHAPE,
  offset: { x: 0, y: 0 },
  rotation: 0,
  scale: { x: 1, y: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const STORAGE_LOCATION = {
  _id: TEST_LOCATION_ID,
  orgId: TEST_ORG_ID,
  storageUnitId: TEST_STORAGE_UNIT_ID,
  name: "Test Location",
  code: "LOC-1",
  storedItems: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Product methods", function () {
  before(async function () {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Organisations.removeAsync(TEST_ORG_ID);
    await Sites.removeAsync(TEST_SITE_ID);
    await FloorMaps.removeAsync(TEST_FLOOR_MAP_ID);
    await StorageUnits.removeAsync(TEST_STORAGE_UNIT_ID);
    await StorageLocations.removeAsync(TEST_LOCATION_ID);

    await Organisations.insertAsync({
      _id: TEST_ORG_ID,
      name: "Test Organisation",
      code: "testorg-products",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await Meteor.users.insertAsync({
      _id: TEST_USER_ID,
      username: "testorg~testuser-products",
      emails: [{ address: "test-products@testorg.com", verified: true }],
      profile: {
        organisationId: TEST_ORG_ID,
        role: TEST_ROLE,
        username: "testuser-products",
      },
    });

    await Sites.insertAsync({
      _id: TEST_SITE_ID,
      orgId: TEST_ORG_ID,
      name: "Test Site",
      description: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await FloorMaps.insertAsync({
      _id: TEST_FLOOR_MAP_ID,
      orgId: TEST_ORG_ID,
      siteId: TEST_SITE_ID,
      name: "Test Floor Map",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await StorageUnits.insertAsync(STORAGE_UNIT);
    await StorageLocations.insertAsync(STORAGE_LOCATION);
  });

  after(async function () {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Organisations.removeAsync(TEST_ORG_ID);
    await Sites.removeAsync(TEST_SITE_ID);
    await FloorMaps.removeAsync(TEST_FLOOR_MAP_ID);
    await StorageUnits.removeAsync(TEST_STORAGE_UNIT_ID);
    await StorageLocations.removeAsync({ orgId: TEST_ORG_ID });
  });

  function callMethod(name, params) {
    return new Promise((resolve, reject) => {
      const method = Meteor.server.method_handlers[name];
      const context = { userId: TEST_USER_ID };
      try {
        const result = method.call(context, params);
        Promise.resolve(result).then(resolve).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  function makeCreateParams(overrides = {}) {
    return {
      name: `Test Product ${Date.now()}`,
      description: "",
      tag: "",
      category: "",
      sku: "",
      brand: "",
      unitCost: 0,
      photoUrl: "",
      images: [],
      catalogImages: [],
      qrCode: "",
      totalQuantity: 10,
      assignments: [{ locationId: TEST_LOCATION_ID, quantity: 10 }],
      ...overrides,
    };
  }

  // create
  describe("products.createWithAssignments", function () {
    let createdProductId;

    afterEach(async function () {
      if (createdProductId) {
        await ProductRecords.removeAsync({ productId: createdProductId });
        await Products.removeAsync(createdProductId);
        createdProductId = null;
      }
    });

    it("returns a string _id", async function () {
      createdProductId = await callMethod("products.createWithAssignments", makeCreateParams());
      assert.strictEqual(typeof createdProductId, "string");
      assert.ok(createdProductId.length > 0);
    });

    it("persists the product to the database", async function () {
      createdProductId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({ name: "Safety Helmet", totalQuantity: 10 }),
      );

      const product = await Products.findOneAsync(createdProductId);
      assert.strictEqual(product.name, "Safety Helmet");
      assert.strictEqual(product.totalQuantity, 10);
    });

    it("creates a ProductRecord for each assignment", async function () {
      await StorageLocations.insertAsync({
        _id: "loc-B-products",
        orgId: TEST_ORG_ID,
        storageUnitId: TEST_STORAGE_UNIT_ID,
        name: "Test Location B",
        code: "LOC-B",
        storedItems: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      createdProductId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({
          totalQuantity: 15,
          assignments: [
            { locationId: TEST_LOCATION_ID, quantity: 10 },
            { locationId: "loc-B-products", quantity: 5 },
          ],
        }),
      );

      const records = await ProductRecords.find({ productId: createdProductId }).fetchAsync();
      const byLocation = Object.fromEntries(records.map((r) => [r.locationId, r.quantity]));

      assert.strictEqual(records.length, 2);
      assert.strictEqual(byLocation[TEST_LOCATION_ID], 10);
      assert.strictEqual(byLocation["loc-B-products"], 5);

      await StorageLocations.removeAsync("loc-B-products");
    });

    it("merges duplicate locationIds by summing their quantities", async function () {
      createdProductId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({
          totalQuantity: 13,
          assignments: [
            { locationId: TEST_LOCATION_ID, quantity: 7 },
            { locationId: TEST_LOCATION_ID, quantity: 6 },
          ],
        }),
      );

      const records = await ProductRecords.find({ productId: createdProductId }).fetchAsync();
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].quantity, 13);
    });

    it("throws duplicate-name when the same name already exists (case-insensitive)", async function () {
      createdProductId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({ name: "Hi-Vis Vest" }),
      );

      await assert.rejects(
        () =>
          callMethod("products.createWithAssignments", makeCreateParams({ name: "hi-vis vest" })),
        (err) => {
          assert.strictEqual(err.error, "duplicate-name");
          return true;
        },
      );
    });

    it("throws quantity-mismatch when assignments do not sum to totalQuantity", async function () {
      await assert.rejects(
        () =>
          callMethod(
            "products.createWithAssignments",
            makeCreateParams({
              totalQuantity: 20,
              assignments: [{ locationId: TEST_LOCATION_ID, quantity: 10 }],
            }),
          ),
        (err) => {
          assert.strictEqual(err.error, "quantity-mismatch");
          return true;
        },
      );
    });
  });

  // delete
  describe("products.delete", function () {
    it("removes the product from the database", async function () {
      const productId = await callMethod("products.createWithAssignments", makeCreateParams());

      await callMethod("products.delete", { productId });

      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product, undefined);
    });

    it("removes all associated ProductRecords", async function () {
      await StorageLocations.insertAsync({
        ...STORAGE_LOCATION,
        _id: "loc-2-products",
        name: "Test Location 2",
        code: "LOC-2",
      });

      const productId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({
          totalQuantity: 10,
          assignments: [
            { locationId: TEST_LOCATION_ID, quantity: 6 },
            { locationId: "loc-2-products", quantity: 4 },
          ],
        }),
      );

      await callMethod("products.delete", { productId });

      const records = await ProductRecords.find({ productId }).fetchAsync();
      assert.strictEqual(records.length, 0);

      await StorageLocations.removeAsync("loc-2-products");
    });

    it("throws product-not-found for an unknown productId", async function () {
      await assert.rejects(
        () => callMethod("products.delete", { productId: "nonexistent-id" }),
        (err) => {
          assert.strictEqual(err.error, "not-found");
          return true;
        },
      );
    });
  });

  // update
  describe("products.update", function () {
    let productId;

    beforeEach(async function () {
      productId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({
          name: `Update Base ${Date.now()}`,
          totalQuantity: 50,
          assignments: [{ locationId: TEST_LOCATION_ID, quantity: 50 }],
        }),
      );
    });

    afterEach(async function () {
      if (productId) {
        await ProductRecords.removeAsync({ productId });
        await Products.removeAsync(productId);
        productId = null;
      }
    });

    it("updates product fields in the database", async function () {
      await callMethod("products.update", {
        ...makeCreateParams({
          name: "Updated Name",
          category: "Power Tools",
          brand: "DeWalt",
          unitCost: 49.99,
          totalQuantity: 50,
          assignments: [{ locationId: TEST_LOCATION_ID, quantity: 50 }],
        }),
        productId,
      });

      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.name, "Updated Name");
      assert.strictEqual(product.category, "Power Tools");
      assert.strictEqual(product.brand, "DeWalt");
      assert.strictEqual(product.unitCost, 49.99);
    });

    it("replaces all ProductRecords with the new assignments", async function () {
      await StorageLocations.insertAsync({
        _id: "loc-B2-products",
        orgId: TEST_ORG_ID,
        storageUnitId: TEST_STORAGE_UNIT_ID,
        name: "Test Location B2",
        shape: UNIT_SHAPE,
        code: "LOC-B2",
        storedItems: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await StorageLocations.insertAsync({
        _id: "loc-A-products",
        orgId: TEST_ORG_ID,
        storageUnitId: TEST_STORAGE_UNIT_ID,
        name: "Test Location A",
        shape: UNIT_SHAPE,
        code: "LOC-A",
        storedItems: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await callMethod("products.update", {
        ...makeCreateParams({
          totalQuantity: 50,
          assignments: [
            { locationId: "loc-A-products", quantity: 30 },
            { locationId: "loc-B2-products", quantity: 20 },
          ],
        }),
        productId,
      });

      const records = await ProductRecords.find({ productId }).fetchAsync();
      const byLocation = Object.fromEntries(records.map((r) => [r.locationId, r.quantity]));

      assert.strictEqual(records.length, 2);
      assert.strictEqual(byLocation["loc-A-products"], 30);
      assert.strictEqual(byLocation["loc-B2-products"], 20);
      assert.strictEqual(byLocation[TEST_LOCATION_ID], undefined);

      await StorageLocations.removeAsync("loc-A-products");
      await StorageLocations.removeAsync("loc-B2-products");
    });

    it("merges duplicate locationIds in the new assignments", async function () {
      await callMethod("products.update", {
        ...makeCreateParams({
          totalQuantity: 50,
          assignments: [
            { locationId: TEST_LOCATION_ID, quantity: 30 },
            { locationId: TEST_LOCATION_ID, quantity: 20 },
          ],
        }),
        productId,
      });

      const records = await ProductRecords.find({ productId }).fetchAsync();
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].quantity, 50);
    });

    it("throws duplicate-name when another product already has the new name", async function () {
      const otherProductId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({ name: "Taken Name" }),
      );

      try {
        await assert.rejects(
          () =>
            callMethod("products.update", {
              ...makeCreateParams({
                name: "taken name",
                totalQuantity: 50,
                assignments: [{ locationId: TEST_LOCATION_ID, quantity: 50 }],
              }),
              productId,
            }),
          (err) => {
            assert.strictEqual(err.error, "duplicate-name");
            return true;
          },
        );
      } finally {
        await ProductRecords.removeAsync({ productId: otherProductId });
        await Products.removeAsync(otherProductId);
      }
    });

    it("allows updating a product to keep its own name", async function () {
      const product = await Products.findOneAsync(productId);

      await callMethod("products.update", {
        ...makeCreateParams({
          name: product.name,
          totalQuantity: 50,
          assignments: [{ locationId: TEST_LOCATION_ID, quantity: 50 }],
        }),
        productId,
      });

      const updated = await Products.findOneAsync(productId);
      assert.strictEqual(updated.name, product.name);
    });

    it("throws quantity-mismatch when assignments do not sum to totalQuantity", async function () {
      await assert.rejects(
        () =>
          callMethod("products.update", {
            ...makeCreateParams({
              totalQuantity: 50,
              assignments: [{ locationId: TEST_LOCATION_ID, quantity: 30 }],
            }),
            productId,
          }),
        (err) => {
          assert.strictEqual(err.error, "quantity-mismatch");
          return true;
        },
      );
    });

    it("does not modify the product on quantity-mismatch", async function () {
      const before = await Products.findOneAsync(productId);

      try {
        await callMethod("products.update", {
          ...makeCreateParams({
            name: "Should Not Stick",
            totalQuantity: 50,
            assignments: [{ locationId: TEST_LOCATION_ID, quantity: 1 }],
          }),
          productId,
        });
      } catch {
        // expected quantity-mismatch rejection
      }

      const after = await Products.findOneAsync(productId);
      assert.strictEqual(after.name, before.name);
      assert.strictEqual(after.totalQuantity, before.totalQuantity);
    });
  });

  // restock
  describe("products.restock", function () {
    let productId;

    beforeEach(async function () {
      productId = await callMethod(
        "products.createWithAssignments",
        makeCreateParams({
          name: `Restock Base ${Date.now()}`,
          totalQuantity: 50,
          assignments: [{ locationId: TEST_LOCATION_ID, quantity: 50 }],
        }),
      );
    });

    afterEach(async function () {
      if (productId) {
        await ProductRecords.removeAsync({ productId });
        await Products.removeAsync(productId);
        productId = null;
      }
    });

    it("increases totalQuantity by additionalQuantity", async function () {
      await callMethod("products.restock", {
        productId,
        additionalQuantity: 25,
        assignments: [{ locationId: TEST_LOCATION_ID, quantity: 75 }],
      });

      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 75);
    });

    it("replaces ProductRecords with the new assignment distribution", async function () {
      await StorageLocations.insertAsync({
        _id: "loc-restock-2-products",
        orgId: TEST_ORG_ID,
        storageUnitId: TEST_STORAGE_UNIT_ID,
        name: "Restock Location 2",
        shape: UNIT_SHAPE,
        code: "LOC-R2",
        storedItems: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await callMethod("products.restock", {
        productId,
        additionalQuantity: 50,
        assignments: [
          { locationId: TEST_LOCATION_ID, quantity: 60 },
          { locationId: "loc-restock-2-products", quantity: 40 },
        ],
      });

      const records = await ProductRecords.find({ productId }).fetchAsync();
      const byLocation = Object.fromEntries(records.map((r) => [r.locationId, r.quantity]));

      assert.strictEqual(records.length, 2);
      assert.strictEqual(byLocation[TEST_LOCATION_ID], 60);
      assert.strictEqual(byLocation["loc-restock-2-products"], 40);

      await StorageLocations.removeAsync("loc-restock-2-products");
    });

    it("merges duplicate locationIds in restock assignments", async function () {
      await callMethod("products.restock", {
        productId,
        additionalQuantity: 25,
        assignments: [
          { locationId: TEST_LOCATION_ID, quantity: 40 },
          { locationId: TEST_LOCATION_ID, quantity: 35 },
        ],
      });

      const records = await ProductRecords.find({ productId }).fetchAsync();
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].quantity, 75);
    });

    it("throws product-not-found for an unknown productId", async function () {
      await assert.rejects(
        () =>
          callMethod("products.restock", {
            productId: "nonexistent-id",
            additionalQuantity: 10,
            assignments: [{ locationId: TEST_LOCATION_ID, quantity: 10 }],
          }),
        (err) => {
          assert.strictEqual(err.error, "not-found");
          return true;
        },
      );
    });

    it("throws invalid-quantity when additionalQuantity is zero", async function () {
      await assert.rejects(
        () =>
          callMethod("products.restock", {
            productId,
            additionalQuantity: 0,
            assignments: [{ locationId: TEST_LOCATION_ID, quantity: 50 }],
          }),
        (err) => {
          assert.strictEqual(err.error, "invalid-quantity");
          return true;
        },
      );
    });

    it("throws invalid-quantity when additionalQuantity is negative", async function () {
      await assert.rejects(
        () =>
          callMethod("products.restock", {
            productId,
            additionalQuantity: -10,
            assignments: [{ locationId: TEST_LOCATION_ID, quantity: 40 }],
          }),
        (err) => {
          assert.strictEqual(err.error, "invalid-quantity");
          return true;
        },
      );
    });

    it("throws quantity-mismatch when assignments do not sum to new total", async function () {
      await assert.rejects(
        () =>
          callMethod("products.restock", {
            productId,
            additionalQuantity: 25,
            assignments: [{ locationId: TEST_LOCATION_ID, quantity: 60 }],
          }),
        (err) => {
          assert.strictEqual(err.error, "quantity-mismatch");
          return true;
        },
      );
    });

    it("does not modify totalQuantity on quantity-mismatch", async function () {
      try {
        await callMethod("products.restock", {
          productId,
          additionalQuantity: 25,
          assignments: [{ locationId: TEST_LOCATION_ID, quantity: 1 }],
        });
      } catch {
        // expected quantity-mismatch rejection
      }

      const product = await Products.findOneAsync(productId);
      assert.strictEqual(product.totalQuantity, 50, "totalQuantity must be unchanged");
    });

    it("does not modify ProductRecords on quantity-mismatch", async function () {
      try {
        await callMethod("products.restock", {
          productId,
          additionalQuantity: 25,
          assignments: [{ locationId: TEST_LOCATION_ID, quantity: 1 }],
        });
      } catch {
        // expected quantity-mismatch rejection
      }

      const records = await ProductRecords.find({ productId }).fetchAsync();
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].quantity, 50, "Original records must be unchanged");
    });
  });
});
