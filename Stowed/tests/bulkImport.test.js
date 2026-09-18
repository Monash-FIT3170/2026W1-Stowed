import assert from "assert";
import { Meteor } from "meteor/meteor";
import { ImportRecords } from "../imports/api/importRecords/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "../imports/api/locations/collections";
import { Organisations } from "../imports/api/organisations";
import { ProductActivities, Products, ProductRecords } from "../imports/api/products/collections";
import "../imports/api/products/methods";
import "../imports/api/bulkImport";

const TEST_USER_ID = "test-user-id-bulk-import";
const TEST_ORG_ID = "test-org-id-bulk-import";
const TEST_ROLE = 3;

function callMethod(name, params) {
  return new Promise((resolve, reject) => {
    const method = Meteor.server.method_handlers[name];
    const context = { userId: TEST_USER_ID };
    try {
      const result = params === undefined ? method.call(context) : method.call(context, params);
      Promise.resolve(result).then(resolve).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

describe("bulk import", function () {
  before(async function () {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Organisations.removeAsync(TEST_ORG_ID);

    await Organisations.insertAsync({
      _id: TEST_ORG_ID,
      name: "Bulk Import Test Organisation",
      code: "testorg-bulk-import",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await Meteor.users.insertAsync({
      _id: TEST_USER_ID,
      username: "testorg-bulk-import~testuser",
      emails: [{ address: "bulk-import@testorg.com", verified: true }],
      profile: {
        organisationId: TEST_ORG_ID,
        role: TEST_ROLE,
        username: "bulkimporter",
      },
    });
  });

  afterEach(async function () {
    const products = await Products.find({ orgId: TEST_ORG_ID }).fetchAsync();
    await ProductRecords.removeAsync({ productId: { $in: products.map((p) => p._id) } });
    await ProductActivities.removeAsync({ orgId: TEST_ORG_ID });
    await Products.removeAsync({ orgId: TEST_ORG_ID });
    await StorageLocations.removeAsync({ orgId: TEST_ORG_ID });
    await StorageUnits.removeAsync({ orgId: TEST_ORG_ID });
    await FloorMaps.removeAsync({ orgId: TEST_ORG_ID });
    await Sites.removeAsync({ orgId: TEST_ORG_ID });
    await ImportRecords.removeAsync({ orgId: TEST_ORG_ID });
  });

  after(async function () {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Organisations.removeAsync(TEST_ORG_ID);
  });

  it("imports combined JSON data and records the created hierarchy", async function () {
    const suffix = Date.now();
    const payload = {
      fileName: "bulk-import-test.json",
      text: JSON.stringify([
        {
          siteName: "Bulk Import Site",
          floorMapName: "Ground Floor",
          floorMapWidth: 12,
          floorMapHeight: 8,
          storageUnitName: "Cabinet A",
          storageUnitType: "cabinet",
          storageUnitOffsetX: 1,
          storageUnitOffsetY: 2,
          storageUnitWidth: 2,
          storageUnitHeight: 1,
          locationName: "Shelf 1",
          locationCode: "BULK-A1",
          name: `Bulk Safety Goggles ${suffix}`,
          description: "Clear anti-fog safety goggles",
          category: "Safety",
          sku: `SAFE-GOG-${suffix}-A`,
          brand: "Uvex",
          unitCost: 11.75,
          totalQuantity: 3,
          assignments: [{ locationCode: "BULK-A1", quantity: 3 }],
          reorderAt: 2,
          qrCode: `QR-BULK-A1-${suffix}`,
        },
        {
          siteName: "Bulk Import Site",
          floorMapName: "Ground Floor",
          floorMapWidth: 12,
          floorMapHeight: 8,
          storageUnitName: "Cabinet A",
          storageUnitType: "cabinet",
          locationName: "Shelf 2",
          locationCode: "BULK-A2",
          name: `Bulk Safety Goggles ${suffix}`,
          description: "Clear anti-fog safety goggles",
          category: "Safety",
          sku: `SAFE-GOG-${suffix}-B`,
          brand: "Uvex",
          unitCost: 11.75,
          totalQuantity: 4,
          assignments: [{ locationCode: "BULK-A2", quantity: 4 }],
          reorderAt: 2,
        },
        {
          siteName: "Bulk Import Site",
          floorMapName: "Ground Floor",
          storageUnitName: "Rack B",
          storageUnitType: "rack",
          locationName: "Bay 1",
          locationCode: "BULK-B1",
          name: `Bulk Batteries ${suffix}`,
          category: "Electronics",
          totalQuantity: 2,
        },
      ]),
    };

    const result = await callMethod("bulk.importCombined", payload);

    assert.deepStrictEqual(result, {
      status: "ok",
      createdProducts: 2,
      updatedProducts: 0,
      createdLocations: 3,
      skippedDuplicateProducts: 0,
    });

    const goggles = await Products.findOneAsync({
      orgId: TEST_ORG_ID,
      name: `Bulk Safety Goggles ${suffix}`,
    });
    const batteries = await Products.findOneAsync({
      orgId: TEST_ORG_ID,
      name: `Bulk Batteries ${suffix}`,
    });
    assert.strictEqual(goggles.totalQuantity, 7);
    assert.strictEqual(goggles.reorderAt, 2);
    assert.strictEqual(batteries.totalQuantity, 2);

    const goggleRecords = await ProductRecords.find({ productId: goggles._id }).fetchAsync();
    assert.strictEqual(goggleRecords.length, 2);
    assert.deepStrictEqual(
      goggleRecords.map((record) => record.quantity).sort((a, b) => a - b),
      [3, 4],
    );

    const floorMap = await FloorMaps.findOneAsync({ orgId: TEST_ORG_ID, name: "Ground Floor" });
    assert.deepStrictEqual(floorMap.floorSize, { width: 600, height: 400 });

    const cabinet = await StorageUnits.findOneAsync({ orgId: TEST_ORG_ID, name: "Cabinet A" });
    assert.strictEqual(cabinet.type, "cabinet");
    assert.deepStrictEqual(cabinet.offset, { x: 1, y: 2 });

    const importRecord = await ImportRecords.findOneAsync({
      orgId: TEST_ORG_ID,
      fileName: "bulk-import-test.json",
    });
    assert.strictEqual(importRecord.status, "completed");
    assert.strictEqual(importRecord.counts.createdProducts, 2);
    assert.strictEqual(importRecord.counts.createdLocations, 3);
    assert.strictEqual(importRecord.createdIds.productIds.length, 2);
    assert.strictEqual(importRecord.createdIds.locationIds.length, 3);
  });

  it("reuses an existing site case-insensitively during combined import", async function () {
    const suffix = Date.now();
    const existingSiteId = await Sites.insertAsync({
      orgId: TEST_ORG_ID,
      name: "Reusable Site",
      description: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await callMethod("bulk.importCombined", {
      fileName: "bulk-import-site-reuse-test.json",
      text: JSON.stringify([
        {
          siteName: "reusable site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "SITE-REUSE-A1",
          name: `Reusable Site Product ${suffix}`,
          totalQuantity: 1,
        },
      ]),
    });

    const matchingSites = await Sites.find({
      orgId: TEST_ORG_ID,
      name: { $regex: /^reusable site$/i },
    }).fetchAsync();
    assert.strictEqual(matchingSites.length, 1);
    assert.strictEqual(matchingSites[0]._id, existingSiteId);
  });

  it("adds up repeated locations for the same product", async function () {
    const suffix = Date.now();
    const productName = `Duplicate Location Product ${suffix}`;

    const result = await callMethod("bulk.importCombined", {
      fileName: "bulk-import-duplicate-location-test.json",
      text: JSON.stringify([
        {
          siteName: "Duplicate Location Site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "DUP-LOC-A1",
          name: productName,
          totalQuantity: 1,
        },
        {
          siteName: "Duplicate Location Site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "DUP-LOC-A1",
          name: productName,
          totalQuantity: 2,
        },
      ]),
    });

    const product = await Products.findOneAsync({ orgId: TEST_ORG_ID, name: productName });
    const records = await ProductRecords.find({ productId: product._id }).fetchAsync();

    assert.strictEqual(result.createdProducts, 1);
    assert.strictEqual(result.createdLocations, 1);
    assert.strictEqual(product.totalQuantity, 3);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].quantity, 3);
  });

  it("allows the same location to be imported for different products", async function () {
    const suffix = Date.now();
    const result = await callMethod("bulk.importCombined", {
      fileName: "bulk-import-shared-location-test.json",
      text: JSON.stringify([
        {
          siteName: "Shared Location Site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "SHARED-LOC-A1",
          name: `Shared Location Product A ${suffix}`,
          totalQuantity: 1,
        },
        {
          siteName: "Shared Location Site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "SHARED-LOC-A1",
          name: `Shared Location Product B ${suffix}`,
          totalQuantity: 2,
        },
      ]),
    });

    assert.strictEqual(result.createdProducts, 2);
    assert.strictEqual(result.createdLocations, 1);
  });

  it("adds import stock to an existing product instead of creating a duplicate", async function () {
    const suffix = Date.now();
    const productName = `Existing Import Product ${suffix}`;

    await callMethod("bulk.importCombined", {
      fileName: "bulk-import-existing-product-original.json",
      text: JSON.stringify([
        {
          siteName: "Existing Product Site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "EXISTING-PRODUCT-A1",
          name: productName,
          totalQuantity: 5,
        },
      ]),
    });

    const result = await callMethod("bulk.importCombined", {
      fileName: "bulk-import-existing-product-restock.json",
      text: JSON.stringify([
        {
          siteName: "existing product site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "EXISTING-PRODUCT-A1",
          name: productName,
          totalQuantity: 3,
        },
        {
          siteName: "existing product site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "EXISTING-PRODUCT-A1",
          name: productName,
          totalQuantity: 2,
        },
      ]),
    });

    const products = await Products.find({ orgId: TEST_ORG_ID, name: productName }).fetchAsync();
    const records = await ProductRecords.find({ productId: products[0]._id }).fetchAsync();
    const latestImport = await ImportRecords.findOneAsync({
      orgId: TEST_ORG_ID,
      fileName: "bulk-import-existing-product-restock.json",
    });

    assert.strictEqual(result.createdProducts, 0);
    assert.strictEqual(result.updatedProducts, 1);
    assert.strictEqual(products.length, 1);
    assert.strictEqual(products[0].totalQuantity, 10);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].quantity, 10);
    assert.strictEqual(latestImport.counts.updatedProducts, 1);
    assert.strictEqual(latestImport.createdIds.stockDeltas.length, 1);

    await callMethod("bulk.undoLatestImport");

    const restoredProduct = await Products.findOneAsync({ orgId: TEST_ORG_ID, name: productName });
    const restoredRecords = await ProductRecords.find({
      productId: restoredProduct._id,
    }).fetchAsync();
    assert.strictEqual(restoredProduct.totalQuantity, 5);
    assert.strictEqual(restoredRecords.length, 1);
    assert.strictEqual(restoredRecords[0].quantity, 5);
  });

  it("clears import history without removing imported data", async function () {
    const suffix = Date.now();
    const productName = `Clear History Product ${suffix}`;

    await callMethod("bulk.importCombined", {
      fileName: "bulk-import-clear-history-test.json",
      text: JSON.stringify([
        {
          siteName: "Clear History Site",
          floorMapName: "Ground Floor",
          storageUnitName: "Cabinet A",
          locationName: "Shelf 1",
          locationCode: "CLEAR-HISTORY-A1",
          name: productName,
          totalQuantity: 5,
        },
      ]),
    });

    const clearResult = await callMethod("bulk.clearImportHistory");

    assert.deepStrictEqual(clearResult, { status: "ok", removed: 1 });
    assert.strictEqual(await ImportRecords.find({ orgId: TEST_ORG_ID }).countAsync(), 0);
    assert.ok(await Products.findOneAsync({ orgId: TEST_ORG_ID, name: productName }));
    assert.ok(
      await StorageLocations.findOneAsync({ orgId: TEST_ORG_ID, code: "CLEAR-HISTORY-A1" }),
    );
  });

  it("undoes the latest completed combined import", async function () {
    const suffix = Date.now();
    await callMethod("bulk.importCombined", {
      fileName: "bulk-import-undo-test.json",
      text: JSON.stringify([
        {
          siteName: "Undo Import Site",
          floorMapName: "Undo Floor",
          storageUnitName: "Undo Cabinet",
          locationName: "Undo Shelf",
          locationCode: "BULK-UNDO-A1",
          name: `Undo Imported Product ${suffix}`,
          totalQuantity: 5,
        },
      ]),
    });

    const undoResult = await callMethod("bulk.undoLatestImport");

    assert.strictEqual(undoResult.status, "ok");
    assert.deepStrictEqual(undoResult.undone, {
      products: 1,
      updatedProducts: 0,
      locations: 1,
      storageUnits: 1,
      floorMaps: 1,
      sites: 1,
    });

    assert.strictEqual(
      await Products.findOneAsync({ orgId: TEST_ORG_ID, name: `Undo Imported Product ${suffix}` }),
      undefined,
    );
    assert.strictEqual(
      await StorageLocations.findOneAsync({ orgId: TEST_ORG_ID, code: "BULK-UNDO-A1" }),
      undefined,
    );

    const importRecord = await ImportRecords.findOneAsync({
      orgId: TEST_ORG_ID,
      fileName: "bulk-import-undo-test.json",
    });
    assert.strictEqual(importRecord.status, "undone");
    assert.strictEqual(importRecord.undoneByUserId, TEST_USER_ID);
  });
});
