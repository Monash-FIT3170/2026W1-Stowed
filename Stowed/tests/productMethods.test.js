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
    catalogImages: [],
    qrCode: "",
    imageUrl: "",
    totalQuantity: 10,
    assignments: [{ locationId: "loc-1", quantity: 10 }],
    ...overrides,
  };
}
 
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