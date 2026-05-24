import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Products, ProductRecords } from './collections';
import { Sites, FloorMaps, StorageUnits, StorageLocations } from '../locations/collections';
import { getCallerOrgId, assertOrgAccess, requirePermission } from '../userMethods';

// Traverses StorageLocation → StorageUnit → FloorMap → Site and asserts org access.
async function assertLocationOrgAccess(locationId, userId) {
  const storageLocation = await StorageLocations.findOneAsync(locationId);
  if (!storageLocation) throw new Meteor.Error('not-found', 'Storage location not found.');
  const storageUnit = await StorageUnits.findOneAsync(storageLocation.storageUnitId);
  if (!storageUnit) throw new Meteor.Error('not-found', 'Storage unit not found.');
  const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
  if (!floorMap) throw new Meteor.Error('not-found', 'Floor map not found.');
  await assertOrgAccess(Sites, floorMap.siteId, userId);
}

/**
 * Merges any duplicate locationIds in an assignments array by summing their
 * quantities. The UI already prevents this, but we do it here too so the data
 * layer is always consistent regardless of how the method was called.
 */
function mergeAssignments(assignments) {
  const map = new Map();
  for (const { locationId, quantity } of assignments) {
    map.set(locationId, (map.get(locationId) ?? 0) + quantity);
  }
  return Array.from(map.entries()).map(([locationId, quantity]) => ({ locationId, quantity }));
}

Meteor.methods({
  /**
   * Creates a new Product along with its location assignments (ProductRecords).
   *
   * @throws {Meteor.Error} not-authorised    - Not logged in.
   * @throws {Meteor.Error} no-org            - Account not linked to an organisation.
   * @throws {Meteor.Error} duplicate-name    - A product with this name already exists.
   * @throws {Meteor.Error} quantity-mismatch - Assigned total not equal to totalQuantity.
   */
  async "products.createWithAssignments"({
    name,
    description = "",
    tag = "",
    category = "",
    sku = "",
    brand = "",
    unitCost = 0,
    photoUrl = "",
    catalogImages = [],
    qrCode = "",
    totalQuantity,
    assignments,
  }) {
    check(name, String);
    check(description, String);
    check(tag, String);
    check(category, String);
    check(sku, String);
    check(brand, String);
    check(unitCost, Number);
    check(photoUrl, String);
    check(catalogImages, [String]);
    check(qrCode, String);
    check(totalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    if (!this.userId) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const orgId = await getCallerOrgId(this.userId);
    if (!orgId) throw new Meteor.Error('no-org', 'Your account is not linked to an organisation.');

    await requirePermission(this.userId, "products.create");

    // Case-insensitive duplicate name check.
    const existing = await Products.findOneAsync({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new Meteor.Error('duplicate-name', `A product named "${name}" already exists.`);
    }

    // Merge any duplicate locationIds by summing their quantities.
    const mergedAssignments = mergeAssignments(assignments);

    // All stock must be accounted for across assignments.
    const assignedTotal = mergedAssignments.reduce((sum, a) => sum + a.quantity, 0);
    if (assignedTotal !== totalQuantity) {
      throw new Meteor.Error(
        'quantity-mismatch',
        `Assigned quantity (${assignedTotal}) must equal total quantity (${totalQuantity}).`
      );
    }

    const now = new Date();
    const productId = await Products.insertAsync({
      orgId,
      name,
      description,
      tag,
      category,
      sku,
      brand,
      unitCost,
      photoUrl,
      catalogImages,
      qrCode,
      totalQuantity,
      images: [],
      createdAt: now,
      updatedAt: now,
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

    return productId;
  },

  /**
   * Updates a Product's details and replaces its location assignments.
   *
   * @throws {Meteor.Error} not-authorised    - Not logged in outside development.
   * @throws {Meteor.Error} duplicate-name    - Another product already has this name.
   * @throws {Meteor.Error} quantity-mismatch - Assigned total not equal to totalQuantity.
   */
  async "products.update"({
    productId,
    name,
    description = "",
    tag = "",
    category = "",
    sku = "",
    brand = "",
    unitCost = 0,
    photoUrl = "",
    catalogImages = [],
    qrCode = "",
    totalQuantity,
    assignments,
  }) {
    check(productId, String);
    check(name, String);
    check(description, String);
    check(tag, String);
    check(category, String);
    check(sku, String);
    check(brand, String);
    check(unitCost, Number);
    check(photoUrl, String);
    check(catalogImages, [String]);
    check(qrCode, String);
    check(totalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    await assertOrgAccess(Products, productId, this.userId);

    await requirePermission(this.userId, "products.update");

    // Duplicate name check excluding this product.
    const existing = await Products.findOneAsync({
      _id: { $ne: productId },
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new Meteor.Error('duplicate-name', `A product named "${name}" already exists.`);
    }

    // Merge any duplicate locationIds by summing their quantities.
    const mergedAssignments = mergeAssignments(assignments);

    const assignedTotal = mergedAssignments.reduce((sum, a) => sum + a.quantity, 0);
    if (assignedTotal !== totalQuantity) {
      throw new Meteor.Error(
        'quantity-mismatch',
        `Assigned quantity (${assignedTotal}) must equal total quantity (${totalQuantity}).`
      );
    }

    const now = new Date();

    await Products.updateAsync(productId, {
      $set: { name, category, brand, totalQuantity, unitCost, updatedAt: now },
    });

    // Replace all records for this product with the merged assignments.
    await ProductRecords.removeAsync({ productId });
    for (const { locationId, quantity } of mergedAssignments) {
      await assertLocationOrgAccess(locationId, this.userId);
      await ProductRecords.insertAsync({ productId, locationId, quantity, createdAt: now, updatedAt: now });
    }
  },

  async 'products.delete'({ productId }) {
    check(productId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    await assertOrgAccess(Products, productId, this.userId);
    await requirePermission(this.userId, "products.delete");

    await ProductRecords.removeAsync({ productId });
    await Products.removeAsync(productId);
  },

  /**
   * Restocks a Product by increasing its total quantity and replacing its
   * location assignments with the updated distribution.
   *
   * @throws {Meteor.Error} not-authorised     - Not logged in outside development.
   * @throws {Meteor.Error} product-not-found  - No product with this _id exists.
   * @throws {Meteor.Error} invalid-quantity   - additionalQuantity is not > 0.
   * @throws {Meteor.Error} quantity-mismatch  - Assignments do not sum to new total.
   */
  async 'products.restock'({ productId, additionalQuantity, assignments }) {
    check(productId, String);
    check(additionalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    await requirePermission(this.userId, "products.restock");

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error('product-not-found', 'No product found with that ID.');
    }

    if (additionalQuantity <= 0) {
      throw new Meteor.Error('invalid-quantity', 'Units being added must be greater than zero.');
    }

    // Merge any duplicate locationIds by summing their quantities.
    const mergedAssignments = mergeAssignments(assignments);

    const newTotal      = product.totalQuantity + additionalQuantity;
    const assignedTotal = mergedAssignments.reduce((sum, a) => sum + a.quantity, 0);
    if (assignedTotal !== newTotal) {
      throw new Meteor.Error(
        'quantity-mismatch',
        `Assigned quantity (${assignedTotal}) must equal new total quantity (${newTotal}).`
      );
    }

    const now = new Date();

    await Products.updateAsync(productId, {
      $set: { totalQuantity: newTotal, updatedAt: now },
    });

    // Replace all records with the merged new assignments.
    await ProductRecords.removeAsync({ productId });
    for (const { locationId, quantity } of mergedAssignments) {
      await ProductRecords.insertAsync({ productId, locationId, quantity, createdAt: now, updatedAt: now });
    }
  },

  /**
   * Creates a new ProductRecord, assigning a quantity of a product to a location.
   *
   * @throws {Meteor.Error} not-authorised - If the user is not logged in outside development.
   */
  async 'productRecords.create'({ productId, locationId, quantity }) {
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
   *
   * @throws {Meteor.Error} not-authorised - If the user is not logged in outside development.
   */
  async 'products.uploadImage'({productId , imagePath}) {
    check(productId, String);
    check(imagePath, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    await requirePermission(this.userId, "products.uploadImage");

    await Products.updateAsync(
      { _id: productId },
      {
        $push: { images: imagePath },
        $set: { updatedAt: new Date() }
      }
    );
  },

});
