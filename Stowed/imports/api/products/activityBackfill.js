import { ProductActivities, Products } from "./collections";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Creates one initial activity for products that predate the activity feed.
 * Products from before organisation scoping are adopted by the seed organisation
 * so they remain visible and cannot prevent the server from starting.
 */
export async function backfillProductActivities(defaultOrgId) {
  if (!isNonEmptyString(defaultOrgId)) {
    throw new Error("A default organisation is required to backfill product activity.");
  }

  const existingProductIds = new Set(
    (await ProductActivities.find({}, { fields: { productId: 1 } }).fetchAsync()).map(
      (activity) => activity.productId,
    ),
  );
  const products = await Products.find({}).fetchAsync();

  for (const product of products) {
    const orgId = isNonEmptyString(product.orgId) ? product.orgId : defaultOrgId;

    if (orgId !== product.orgId) {
      await Products.updateAsync(product._id, { $set: { orgId } });
    }

    if (existingProductIds.has(product._id)) continue;

    const activity = {
      orgId,
      productId: product._id,
      productName: isNonEmptyString(product.name) ? product.name : "Unnamed product",
      action: "updated",
      actorUsername: isNonEmptyString(product.updatedByUsername)
        ? product.updatedByUsername
        : "User not recorded",
      createdAt: isValidDate(product.updatedAt)
        ? product.updatedAt
        : isValidDate(product.createdAt)
          ? product.createdAt
          : new Date(),
    };
    if (isNonEmptyString(product.updatedByUserId)) {
      activity.actorUserId = product.updatedByUserId;
    }
    if (Number.isInteger(product.totalQuantity) && product.totalQuantity >= 0) {
      activity.quantityAfter = product.totalQuantity;
    }

    await ProductActivities.insertAsync(activity);
  }
}
