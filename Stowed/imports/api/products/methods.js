import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { ProductActivities, Products, ProductRecords } from "./collections";
import { Sites, FloorMaps, StorageUnits, StorageLocations } from "../locations/collections";
import { getCallerOrgId, assertOrgAccess, requirePermission } from "../userMethods";

async function getProductUpdateMetadata(userId) {
  if (!userId) return { updatedByUsername: "System" };

  const user = await Meteor.users.findOneAsync(userId, {
    fields: { username: 1, "profile.username": 1 },
  });

  return {
    updatedByUserId: userId,
    updatedByUsername: user?.profile?.username || user?.username || "Unknown user",
  };
}

async function recordProductActivity({
  product,
  action,
  updateMetadata,
  createdAt,
  quantityBefore,
  quantityAfter,
  location,
}) {
  const activity = {
    orgId: product.orgId,
    productId: product._id,
    productName: product.name,
    action,
    actorUsername: updateMetadata.updatedByUsername || "Unknown user",
    createdAt,
  };

  if (updateMetadata.updatedByUserId) {
    activity.actorUserId = updateMetadata.updatedByUserId;
  }
  if (Number.isInteger(quantityBefore)) activity.quantityBefore = quantityBefore;
  if (Number.isInteger(quantityAfter)) activity.quantityAfter = quantityAfter;
  if (location?._id) activity.locationId = location._id;
  if (location?.name) activity.locationName = location.name;

  return ProductActivities.insertAsync(activity);
}

// Traverses StorageLocation -> StorageUnit -> FloorMap -> Site and asserts org access.
async function assertLocationOrgAccess(locationId, userId) {
  const storageLocation = await StorageLocations.findOneAsync(locationId);
  if (!storageLocation) throw new Meteor.Error("not-found", "Storage location not found.");
  const storageUnit = await StorageUnits.findOneAsync(storageLocation.storageUnitId);
  if (!storageUnit) throw new Meteor.Error("not-found", "Storage unit not found.");
  const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
  if (!floorMap) throw new Meteor.Error("not-found", "Floor map not found.");
  await assertOrgAccess(Sites, floorMap.siteId, userId);
  return storageLocation;
}

/**
 * Merges any duplicate locationIds in an assignments array by summing their quantities.
 *
 * e.g. [{ locationId: 'A', quantity: 7 }, { locationId: 'A', quantity: 6 }]
 *      -> [{ locationId: 'A', quantity: 13 }]
 */
function mergeAssignments(assignments) {
  const map = new Map();
  for (const { locationId, quantity } of assignments) {
    map.set(locationId, (map.get(locationId) ?? 0) + quantity);
  }
  return Array.from(map.entries()).map(([locationId, quantity]) => ({
    locationId,
    quantity,
  }));
}

Meteor.methods({
  /**
   * Creates a new Product along with its location assignments (ProductRecords).
   */
  async "products.createWithAssignments"({
    name,
    description = "",
    categoryId = "",
    sku = "",
    brand = "",
    unitCost = 0,
    purchaseCost = 0,
    reorderAt,
    photoUrl = "",
    images = [],
    catalogImages = [],
    qrCode = "",
    totalQuantity,
    assignments,
  }) {
    check(name, String);
    check(description, String);
    check(categoryId, String);
    check(sku, String);
    check(brand, String);
    check(unitCost, Number);
    check(purchaseCost, Number);
    check(photoUrl, String);
    check(images, [String]);
    check(catalogImages, [String]);
    check(qrCode, String);
    check(totalQuantity, Match.Integer);
    check(reorderAt, Match.Maybe(Match.Integer));
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    if (!this.userId) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const orgId = await getCallerOrgId(this.userId);
    if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

    await requirePermission(this.userId, "products.create");

    // Case-insensitive duplicate name check, scoped to the caller's org.
    const existing = await Products.findOneAsync({
      orgId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      throw new Meteor.Error("duplicate-name", `A product named "${name}" already exists.`);
    }

    // Merge any duplicate locationIds by summing their quantities.
    const mergedAssignments = mergeAssignments(assignments);

    // All stock must be accounted for across assignments.
    const assignedTotal = mergedAssignments.reduce((sum, a) => sum + a.quantity, 0);
    if (assignedTotal !== totalQuantity) {
      throw new Meteor.Error(
        "quantity-mismatch",
        `Assigned quantity (${assignedTotal}) must equal total quantity (${totalQuantity}).`,
      );
    }

    const now = new Date();
    const updateMetadata = await getProductUpdateMetadata(this.userId);
    const galleryImages = images.length ? images : catalogImages;
    const primaryPhotoUrl = photoUrl || galleryImages[0] || "";
    const productId = await Products.insertAsync({
      orgId,
      name,
      description,
      categoryId,
      sku,
      brand,
      unitCost,
      purchaseCost,
      photoUrl: primaryPhotoUrl,
      images: galleryImages,
      catalogImages,
      qrCode,
      totalQuantity,
      // A blank threshold means "no threshold", so leave the field off entirely.
      ...(reorderAt != null && { reorderAt }),
      createdAt: now,
      updatedAt: now,
      ...updateMetadata,
    });

    for (const { locationId, quantity } of mergedAssignments) {
      await assertLocationOrgAccess(locationId, this.userId);
      await ProductRecords.insertAsync({
        productId,
        locationId,
        quantity,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordProductActivity({
      product: { _id: productId, orgId, name },
      action: "created",
      updateMetadata,
      createdAt: now,
      quantityBefore: 0,
      quantityAfter: totalQuantity,
    });

    return productId;
  },

  /**
   * Updates a Product's details and replaces its location assignments.
   *
   * Fields the caller omits are left as they are rather than blanked, so a form
   * that only edits part of a product can't wipe the rest of it.
   */
  async "products.update"({
    productId,
    name,
    description,
    categoryId,
    sku,
    brand,
    unitCost = 0,
    purchaseCost = 0,
    reorderAt,
    photoUrl = "",
    images = [],
    catalogImages = [],
    qrCode,
    totalQuantity,
    assignments,
  }) {
    check(productId, String);
    check(name, String);
    check(description, Match.Maybe(String));
    check(categoryId, Match.Maybe(String));
    check(sku, Match.Maybe(String));
    check(brand, Match.Maybe(String));
    check(unitCost, Number);
    check(purchaseCost, Number);
    check(reorderAt, Match.Maybe(Match.Integer));
    check(photoUrl, String);
    check(images, [String]);
    check(catalogImages, [String]);
    check(qrCode, Match.Maybe(String));
    check(totalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    await assertOrgAccess(Products, productId, this.userId);
    await requirePermission(this.userId, "products.update");

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error("product-not-found", "No product found with that ID.");
    }

    const existing = await Products.findOneAsync({
      _id: { $ne: productId },
      orgId: product.orgId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      throw new Meteor.Error("duplicate-name", `A product named "${name}" already exists.`);
    }

    const mergedAssignments = mergeAssignments(assignments);

    const assignedTotal = mergedAssignments.reduce((sum, a) => sum + a.quantity, 0);
    if (assignedTotal !== totalQuantity) {
      throw new Meteor.Error(
        "quantity-mismatch",
        `Assigned quantity (${assignedTotal}) must equal total quantity (${totalQuantity}).`,
      );
    }

    const now = new Date();
    const updateMetadata = await getProductUpdateMetadata(this.userId);
    const galleryImages = images.length ? images : catalogImages;
    const primaryPhotoUrl = photoUrl || product.photoUrl || galleryImages[0] || "";

    const $set = {
      name,
      unitCost,
      purchaseCost,
      photoUrl: primaryPhotoUrl,
      images: galleryImages,
      totalQuantity,
      updatedAt: now,
      ...updateMetadata,
    };

    // An omitted field means "leave it alone", so only write what was sent.
    for (const [field, value] of Object.entries({
      description,
      categoryId,
      sku,
      brand,
      qrCode,
    })) {
      if (value !== undefined) $set[field] = value;
    }

    // A blank reorder threshold means "no threshold", which is an absent field
    // rather than a null one.
    const modifier = { $set };
    if (reorderAt == null) {
      modifier.$unset = { reorderAt: "" };
    } else {
      $set.reorderAt = reorderAt;
    }

    await Products.updateAsync(productId, modifier);

    // preserve previous product record
    const oldRecords = await ProductRecords.find({ productId }).fetchAsync();

    await ProductRecords.removeAsync({ productId });
    for (const { locationId, quantity } of mergedAssignments) {
      await assertLocationOrgAccess(locationId, this.userId);

      const oldRecord = oldRecords.find((record) => record.locationId === locationId);

      await ProductRecords.insertAsync({
        productId,
        locationId,
        quantity,
        createdAt: oldRecord?.createdAt ?? now,
        updatedAt: now,
      });
    }

    await recordProductActivity({
      product: { ...product, name },
      action: "updated",
      updateMetadata,
      createdAt: now,
      quantityBefore: product.totalQuantity,
      quantityAfter: totalQuantity,
    });
  },

  /**
   * Deletes a Product and all of its associated ProductRecords.
   */
  async "products.delete"({ productId }) {
    check(productId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await assertOrgAccess(Products, productId, this.userId);
    await requirePermission(this.userId, "products.delete");

    const product = await Products.findOneAsync(productId);
    const updateMetadata = await getProductUpdateMetadata(this.userId);
    const now = new Date();

    await ProductRecords.removeAsync({ productId });
    await Products.removeAsync(productId);

    await recordProductActivity({
      product,
      action: "deleted",
      updateMetadata,
      createdAt: now,
      quantityBefore: product.totalQuantity,
    });
  },

  /**
   * Restocks a Product by increasing its total quantity and replacing its
   * location assignments with the updated distribution.
   */
  async "products.restock"({ productId, additionalQuantity, assignments }) {
    check(productId, String);
    check(additionalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await assertOrgAccess(Products, productId, this.userId);
    await requirePermission(this.userId, "products.restock");

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error("product-not-found", "No product found with that ID.");
    }

    if (additionalQuantity <= 0) {
      throw new Meteor.Error("invalid-quantity", "Units being added must be greater than zero.");
    }

    const mergedAssignments = mergeAssignments(assignments);

    const newTotal = product.totalQuantity + additionalQuantity;
    const assignedTotal = mergedAssignments.reduce((sum, a) => sum + a.quantity, 0);
    if (assignedTotal !== newTotal) {
      throw new Meteor.Error(
        "quantity-mismatch",
        `Assigned quantity (${assignedTotal}) must equal new total quantity (${newTotal}).`,
      );
    }

    const now = new Date();
    const updateMetadata = await getProductUpdateMetadata(this.userId);

    await Products.updateAsync(productId, {
      $set: { totalQuantity: newTotal, updatedAt: now, ...updateMetadata },
    });

    const oldRecords = await ProductRecords.find({ productId }).fetchAsync();
    await ProductRecords.removeAsync({ productId });
    for (const { locationId, quantity } of mergedAssignments) {
      const oldRecord = oldRecords.find((record) => record.locationId === locationId);
      await ProductRecords.insertAsync({
        productId,
        locationId,
        quantity,
        createdAt: oldRecord?.createdAt ?? now,
        updatedAt: now,
      });
    }

    await recordProductActivity({
      product,
      action: "restocked",
      updateMetadata,
      createdAt: now,
      quantityBefore: product.totalQuantity,
      quantityAfter: newTotal,
    });
  },

  /**
   * Marks shopping-list stock as received: increases a Product's total
   * quantity and adds it to the given site's ProductRecord.
   */
  async "products.receiveStock"({ productId, siteId, quantity }) {
    check(productId, String);
    check(siteId, String);
    check(quantity, Match.Integer);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await assertOrgAccess(Products, productId, this.userId);
    await assertOrgAccess(Sites, siteId, this.userId);
    await requirePermission(this.userId, "products.receiveStock");

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error("product-not-found", "No product found with that ID.");
    }

    if (quantity <= 0) {
      throw new Meteor.Error("invalid-quantity", "Received quantity must be greater than zero.");
    }

    const now = new Date();

    await Products.updateAsync(productId, {
      $set: { totalQuantity: product.totalQuantity + quantity, updatedAt: now },
    });

    const record = await ProductRecords.findOneAsync({ productId, locationId: siteId });
    if (record) {
      await ProductRecords.updateAsync(record._id, {
        $set: { quantity: record.quantity + quantity, updatedAt: now },
      });
    } else {
      await ProductRecords.insertAsync({
        productId,
        locationId: siteId,
        quantity,
        createdAt: now,
        updatedAt: now,
      });
    }
  },

  /**
   * Undoes a stock receipt — the inverse of "products.receiveStock".
   */
  async "products.unreceiveStock"({ productId, siteId, quantity }) {
    check(productId, String);
    check(siteId, String);
    check(quantity, Match.Integer);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await assertOrgAccess(Products, productId, this.userId);
    await assertOrgAccess(Sites, siteId, this.userId);
    await requirePermission(this.userId, "products.receiveStock");

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error("product-not-found", "No product found with that ID.");
    }

    if (quantity <= 0) {
      throw new Meteor.Error("invalid-quantity", "Quantity must be greater than zero.");
    }

    const record = await ProductRecords.findOneAsync({ productId, locationId: siteId });
    if (!record || record.quantity < quantity || product.totalQuantity < quantity) {
      throw new Meteor.Error("insufficient-stock", "Not enough received stock left to undo.");
    }

    const now = new Date();

    await Products.updateAsync(productId, {
      $set: { totalQuantity: product.totalQuantity - quantity, updatedAt: now },
    });

    if (record.quantity === quantity) {
      await ProductRecords.removeAsync(record._id);
    } else {
      await ProductRecords.updateAsync(record._id, {
        $set: { quantity: record.quantity - quantity, updatedAt: now },
      });
    }
  },

  /**
   * Moves received shopping-list stock from the temporary site holding record
   * into a concrete storage location.
   */
  async "products.allocateReceivedStock"({ productId, siteId, storageLocationId, quantity }) {
    check(productId, String);
    check(siteId, String);
    check(storageLocationId, String);
    check(quantity, Match.Integer);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await assertOrgAccess(Products, productId, this.userId);
    await assertOrgAccess(Sites, siteId, this.userId);
    await assertLocationOrgAccess(storageLocationId, this.userId);
    await requirePermission(this.userId, "products.receiveStock");

    if (quantity <= 0) {
      throw new Meteor.Error("invalid-quantity", "Allocated quantity must be greater than zero.");
    }

    const holdingRecord = await ProductRecords.findOneAsync({ productId, locationId: siteId });
    if (!holdingRecord || holdingRecord.quantity < quantity) {
      throw new Meteor.Error(
        "insufficient-received-stock",
        "There is not enough received stock waiting at this site.",
      );
    }

    const now = new Date();

    if (holdingRecord.quantity === quantity) {
      await ProductRecords.removeAsync(holdingRecord._id);
    } else {
      await ProductRecords.updateAsync(holdingRecord._id, {
        $set: { quantity: holdingRecord.quantity - quantity, updatedAt: now },
      });
    }

    const storageRecord = await ProductRecords.findOneAsync({
      productId,
      locationId: storageLocationId,
    });
    if (storageRecord) {
      await ProductRecords.updateAsync(storageRecord._id, {
        $set: { quantity: storageRecord.quantity + quantity, updatedAt: now },
      });
    } else {
      await ProductRecords.insertAsync({
        productId,
        locationId: storageLocationId,
        quantity,
        createdAt: now,
        updatedAt: now,
      });
    }
  },

  /**
   * Applies a completed stocktake to one storage location.
   *
   * `lines` is the full intended contents of the location, not a list of edits:
   * any existing record whose product is absent from `lines` is deleted. Each
   * affected product's totalQuantity is then recomputed from its remaining
   * records, so the invariant that a product's total equals the sum of its
   * records holds even if it was already broken beforehand.
   */
  async "stocktake.save"({ locationId, lines }) {
    check(locationId, String);
    check(lines, [{ productId: String, quantity: Match.Integer }]);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    const stocktakeLocation = await assertLocationOrgAccess(locationId, this.userId);
    await requirePermission(this.userId, "stocktake.save");

    if (lines.some(({ quantity }) => quantity < 0)) {
      throw new Meteor.Error("invalid-quantity", "Counted quantities cannot be negative.");
    }

    // Two lines for the same product would otherwise overwrite each other.
    const counted = new Map();
    for (const { productId, quantity } of lines) {
      counted.set(productId, (counted.get(productId) ?? 0) + quantity);
    }

    for (const productId of counted.keys()) {
      await assertOrgAccess(Products, productId, this.userId);
    }

    const existingRecords = await ProductRecords.find({ locationId }).fetchAsync();

    // A product should hold at most one record per location. Group rather than
    // assume, because totals are recomputed by summing records below — a stray
    // duplicate would otherwise inflate the product's total.
    const recordsByProduct = new Map();
    for (const record of existingRecords) {
      recordsByProduct.set(record.productId, [
        ...(recordsByProduct.get(record.productId) ?? []),
        record,
      ]);
    }

    const now = new Date();
    const updateMetadata = await getProductUpdateMetadata(this.userId);
    // Only products whose stock actually moved need their total recomputed.
    const changedProductIds = new Set();

    // Counted products: insert the new ones, update the ones that changed.
    for (const [productId, quantity] of counted) {
      const [record, ...duplicates] = recordsByProduct.get(productId) ?? [];

      if (!record) {
        await ProductRecords.insertAsync({
          productId,
          locationId,
          quantity,
          createdAt: now,
          updatedAt: now,
        });
        changedProductIds.add(productId);
      } else if (record.quantity !== quantity) {
        await ProductRecords.updateAsync(record._id, {
          $set: { quantity, updatedAt: now },
        });
        changedProductIds.add(productId);
      }

      for (const duplicate of duplicates) {
        await ProductRecords.removeAsync(duplicate._id);
        changedProductIds.add(productId);
      }
    }

    // Anything no longer counted here has left the location.
    for (const record of existingRecords) {
      if (!counted.has(record.productId)) {
        await ProductRecords.removeAsync(record._id);
        changedProductIds.add(record.productId);
      }
    }

    for (const productId of changedProductIds) {
      const records = await ProductRecords.find({ productId }).fetchAsync();
      const totalQuantity = records.reduce((sum, record) => sum + record.quantity, 0);
      const product = await Products.findOneAsync(productId);
      await Products.updateAsync(productId, {
        $set: { totalQuantity, updatedAt: now, ...updateMetadata },
      });
      await recordProductActivity({
        product,
        action: "stocktake",
        updateMetadata,
        createdAt: now,
        quantityBefore: product.totalQuantity,
        quantityAfter: totalQuantity,
        location: stocktakeLocation,
      });
    }

    // The count happened even if nothing needed changing.
    await StorageLocations.updateAsync(locationId, {
      $set: { lastStocktakeAt: now, updatedAt: now },
    });

    return { productsChanged: changedProductIds.size };
  },

  /**
   * Creates a new ProductRecord.
   */
  async "productRecords.create"({ productId, locationId, quantity }) {
    check(productId, String);
    check(locationId, String);
    check(quantity, Match.Integer);

    await assertOrgAccess(Products, productId, this.userId);
    await assertLocationOrgAccess(locationId, this.userId);

    await requirePermission(this.userId, "products.create");

    const now = new Date();
    return await ProductRecords.insertAsync({
      productId,
      locationId,
      quantity,
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Adds an image path/URL to a Product document.
   */
  async "products.uploadImage"({ productId, imagePath }) {
    check(productId, String);
    check(imagePath, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await assertOrgAccess(Products, productId, this.userId);
    await requirePermission(this.userId, "products.uploadImage");

    const product = await Products.findOneAsync(productId);
    const updateMetadata = await getProductUpdateMetadata(this.userId);
    const now = new Date();

    await Products.updateAsync(
      { _id: productId },
      {
        $push: { images: imagePath },
        $set: { updatedAt: now, ...updateMetadata },
      },
    );
    await recordProductActivity({
      product,
      action: "images-updated",
      updateMetadata,
      createdAt: now,
    });
  },

  async "products.setImages"({ productId, images }) {
    check(productId, String);
    check(images, [String]);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error("not-authorised", "You must be logged in.");
    }

    await assertOrgAccess(Products, productId, this.userId);
    await requirePermission(this.userId, "products.update");

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error("product-not-found", "No product found with that ID.");
    }

    const primaryPhotoUrl =
      images.length > 0 && !images.includes(product.photoUrl)
        ? images[0]
        : product.photoUrl || images[0] || "";
    const updateMetadata = await getProductUpdateMetadata(this.userId);
    const now = new Date();

    await Products.updateAsync(
      { _id: productId },
      {
        $set: {
          images,
          photoUrl: primaryPhotoUrl,
          updatedAt: now,
          ...updateMetadata,
        },
      },
    );
    await recordProductActivity({
      product,
      action: "images-updated",
      updateMetadata,
      createdAt: now,
    });
  },
});