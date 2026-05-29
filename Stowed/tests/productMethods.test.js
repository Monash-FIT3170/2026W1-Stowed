import assert from "assert";
import { Meteor } from "meteor/meteor";
import { Products, ProductRecords } from "../imports/api/products/collections";
import "../imports/api/products/methods";
 
function callMethod(name, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(name, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
 
// So new params dont have to be defined every test
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
    assignments: [{ locationId: "loc-1", quantity: 10 }],
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
    createdProductId = await callMethod(
      "products.createWithAssignments",
      makeCreateParams({
        totalQuantity: 15,
        assignments: [
          { locationId: "loc-A", quantity: 10 },
          { locationId: "loc-B", quantity: 5 },
        ],
      }),
    );
 
    const records = await ProductRecords.find({ productId: createdProductId }).fetchAsync();
    const byLocation = Object.fromEntries(records.map((r) => [r.locationId, r.quantity]));
 
    assert.strictEqual(records.length, 2);
    assert.strictEqual(byLocation["loc-A"], 10);
    assert.strictEqual(byLocation["loc-B"], 5);
  });
 
  it("merges duplicate locationIds by summing their quantities", async function () {
    createdProductId = await callMethod(
      "products.createWithAssignments",
      makeCreateParams({
        totalQuantity: 13,
        assignments: [
          { locationId: "loc-1", quantity: 7 },
          { locationId: "loc-1", quantity: 6 },
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
      () => callMethod("products.createWithAssignments", makeCreateParams({ name: "hi-vis vest" })),
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
            assignments: [{ locationId: "loc-1", quantity: 10 }],
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
    const productId = await callMethod(
      "products.createWithAssignments",
      makeCreateParams(),
    );
 
    await callMethod("products.delete", { productId });
 
    const product = await Products.findOneAsync(productId);
    assert.strictEqual(product, undefined);
  });
 
  it("removes all associated ProductRecords", async function () {
    const productId = await callMethod(
      "products.createWithAssignments",
      makeCreateParams({
        totalQuantity: 10,
        assignments: [
          { locationId: "loc-1", quantity: 6 },
          { locationId: "loc-2", quantity: 4 },
        ],
      }),
    );
 
    await callMethod("products.delete", { productId });
 
    const records = await ProductRecords.find({ productId }).fetchAsync();
    assert.strictEqual(records.length, 0);
  });
 
  it("throws product-not-found for an unknown productId", async function () {
    await assert.rejects(
      () => callMethod("products.delete", { productId: "nonexistent-id" }),
      (err) => {
        assert.strictEqual(err.error, "product-not-found");
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
        assignments: [{ locationId: "loc-1", quantity: 50 }],
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
        assignments: [{ locationId: "loc-1", quantity: 50 }],
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
    await callMethod("products.update", {
      ...makeCreateParams({
        totalQuantity: 50,
        assignments: [
          { locationId: "loc-A", quantity: 30 },
          { locationId: "loc-B", quantity: 20 },
        ],
      }),
      productId,
    });
 
    const records = await ProductRecords.find({ productId }).fetchAsync();
    const byLocation = Object.fromEntries(records.map((r) => [r.locationId, r.quantity]));
 
    assert.strictEqual(records.length, 2);
    assert.strictEqual(byLocation["loc-A"], 30);
    assert.strictEqual(byLocation["loc-B"], 20);
    // Original loc-1 record should be gone
    assert.strictEqual(byLocation["loc-1"], undefined);
  });
 
  it("merges duplicate locationIds in the new assignments", async function () {
    await callMethod("products.update", {
      ...makeCreateParams({
        totalQuantity: 50,
        // 30 + 20 = 50, same location
        assignments: [
          { locationId: "loc-1", quantity: 30 },
          { locationId: "loc-1", quantity: 20 },
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
              name: "taken name", // case-insensitive collision
              totalQuantity: 50,
              assignments: [{ locationId: "loc-1", quantity: 50 }],
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
 
    // Should not throw duplicate-name against itself
    await callMethod("products.update", {
      ...makeCreateParams({
        name: product.name,
        totalQuantity: 50,
        assignments: [{ locationId: "loc-1", quantity: 50 }],
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
            assignments: [{ locationId: "loc-1", quantity: 30 }], // 30 ≠ 50
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
          assignments: [{ locationId: "loc-1", quantity: 1 }], // mismatch
        }),
        productId,
      });
    } catch (_) {}
 
    const after = await Products.findOneAsync(productId);
    assert.strictEqual(after.name, before.name);
    assert.strictEqual(after.totalQuantity, before.totalQuantity);
  });
});