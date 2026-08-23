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
      createdLocations: 3,
      skippedDuplicateProducts: 0,
    });

    const goggles = await Products.findOneAsync({ orgId: TEST_ORG_ID, name: `Bulk Safety Goggles ${suffix}` });
    const batteries = await Products.findOneAsync({ orgId: TEST_ORG_ID, name: `Bulk Batteries ${suffix}` });
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

    const importRecord = await ImportRecords.findOneAsync({ orgId: TEST_ORG_ID, fileName: "bulk-import-test.json" });
    assert.strictEqual(importRecord.status, "completed");
    assert.strictEqual(importRecord.counts.createdProducts, 2);
    assert.strictEqual(importRecord.counts.createdLocations, 3);
    assert.strictEqual(importRecord.createdIds.productIds.length, 2);
    assert.strictEqual(importRecord.createdIds.locationIds.length, 3);
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
      locations: 1,
      storageUnits: 1,
      floorMaps: 1,
      sites: 1,
    });

    assert.strictEqual(await Products.findOneAsync({ orgId: TEST_ORG_ID, name: `Undo Imported Product ${suffix}` }), undefined);
    assert.strictEqual(await StorageLocations.findOneAsync({ orgId: TEST_ORG_ID, code: "BULK-UNDO-A1" }), undefined);

    const importRecord = await ImportRecords.findOneAsync({ orgId: TEST_ORG_ID, fileName: "bulk-import-undo-test.json" });
    assert.strictEqual(importRecord.status, "undone");
    assert.strictEqual(importRecord.undoneByUserId, TEST_USER_ID);
  });
});
