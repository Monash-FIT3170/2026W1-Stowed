import assert from "assert";
import { backfillProductActivities } from "../imports/api/products/activityBackfill";
import { ProductActivities, Products } from "../imports/api/products/collections";

describe("product activity backfill", function () {
  const productId = "legacy-product-without-org";
  const defaultOrgId = "legacy-default-org";

  afterEach(async function () {
    await ProductActivities.removeAsync({ productId });
    await Products.rawCollection().deleteOne({ _id: productId });
  });

  it("adopts legacy products into the default organisation before creating activity", async function () {
    const updatedAt = new Date("2025-01-02T03:04:05.000Z");
    await Products.rawCollection().insertOne({
      _id: productId,
      name: "Legacy gloves",
      totalQuantity: 12,
      createdAt: updatedAt,
      updatedAt,
    });

    await backfillProductActivities(defaultOrgId);

    const product = await Products.findOneAsync(productId);
    const activity = await ProductActivities.findOneAsync({ productId });
    assert.strictEqual(product.orgId, defaultOrgId);
    assert.strictEqual(activity.orgId, defaultOrgId);
    assert.strictEqual(activity.productName, "Legacy gloves");
    assert.strictEqual(activity.quantityAfter, 12);
    assert.deepStrictEqual(activity.createdAt, updatedAt);
  });
});
