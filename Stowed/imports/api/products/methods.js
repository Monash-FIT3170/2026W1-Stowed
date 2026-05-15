import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Products, ProductRecords } from './collections';

/**
 * Merges any duplicate locationIds in an assignments array by summing their
 * quantities. The UI already prevents this, but we do it here too so the data
 * layer is always consistent regardless of how the method was called.
 *
 * e.g. [{ locationId: 'A', quantity: 7 }, { locationId: 'A', quantity: 6 }]
 *      → [{ locationId: 'A', quantity: 13 }]
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
   * Validates that:
   *  - No existing product shares the same name (case-insensitive).
   *  - The sum of all assignment quantities equals totalQuantity.
   *
   * @param {Object}   params
   * @param {string}   params.name
   * @param {string}   [params.description='']
   * @param {number}   params.totalQuantity
   * @param {Object[]} params.assignments
   * @param {string}   params.assignments[].locationId
   * @param {number}   params.assignments[].quantity
   * @returns {string} The _id of the newly created product document.
   *
   * @throws {Meteor.Error} not-authorised    - Not logged in outside development.
   * @throws {Meteor.Error} duplicate-name    - A product with this name already exists.
   * @throws {Meteor.Error} quantity-mismatch - Assigned total not equal to totalQuantity.
   */
  async 'products.createWithAssignments'({ name, description = '', totalQuantity, assignments }) {
    check(name, String);
    check(description, String);
    check(totalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

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
      name,
      description,
      totalQuantity,
      createdAt: now,
      updatedAt: now,
    });

    for (const { locationId, quantity } of mergedAssignments) {
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
   * All existing ProductRecords for the product are removed and recreated
   * from the new assignments array, keeping the data model consistent.
   *
   * Validates that:
   *  - The product exists.
   *  - No other product shares the new name (case-insensitive).
   *  - The sum of all assignment quantities equals totalQuantity.
   *
   * @param {Object}   params
   * @param {string}   params.productId
   * @param {string}   params.name
   * @param {string}   [params.description='']
   * @param {number}   params.totalQuantity
   * @param {Object[]} params.assignments
   * @param {string}   params.assignments[].locationId
   * @param {number}   params.assignments[].quantity
   *
   * @throws {Meteor.Error} not-authorised    - Not logged in outside development.
   * @throws {Meteor.Error} product-not-found - No product with this _id exists.
   * @throws {Meteor.Error} duplicate-name    - Another product already has this name.
   * @throws {Meteor.Error} quantity-mismatch - Assigned total not equal to totalQuantity.
   */
  async 'products.update'({ productId, name, description = '', totalQuantity, assignments }) {
    check(productId, String);
    check(name, String);
    check(description, String);
    check(totalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error('product-not-found', 'No product found with that ID.');
    }

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
      $set: { name, description, totalQuantity, updatedAt: now },
    });

    // Replace all records for this product with the merged assignments.
    await ProductRecords.removeAsync({ productId });
    for (const { locationId, quantity } of mergedAssignments) {
      await ProductRecords.insertAsync({ productId, locationId, quantity, createdAt: now, updatedAt: now });
    }
  },

  /**
   * Deletes a Product and all of its associated ProductRecords.
   *
   * Records are removed first so there is no window where the product exists
   * without its records being cleaned up.
   *
   * @param {Object} params
   * @param {string} params.productId - The _id of the product to delete.
   *
   * @throws {Meteor.Error} not-authorised  - Not logged in outside development.
   * @throws {Meteor.Error} product-not-found - No product with this _id exists.
   */
  async 'products.delete'({ productId }) {
    check(productId, String);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const product = await Products.findOneAsync(productId);
    if (!product) {
      throw new Meteor.Error('product-not-found', 'No product found with that ID.');
    }

    await ProductRecords.removeAsync({ productId });
    await Products.removeAsync(productId);
  },

  /**
   * Creates a new ProductRecord, assigning a quantity of a product to a location.
   *
   * @param {Object} params
   * @param {string} params.productId   - ID of the parent Product.
   * @param {string} params.locationId  - ID of the StorageLocation.
   * @param {number} params.quantity    - Quantity of the product at this location.
   * @returns {string} The _id of the newly created ProductRecord document.
   *
   * @throws {Meteor.Error} not-authorised - If the user is not logged in outside development.
   */
  async 'productRecords.create'({ productId, locationId, quantity }) {
    check(productId, String);
    check(locationId, String);
    check(quantity, Match.Integer);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const now = new Date();
    return await ProductRecords.insertAsync({
      productId,
      locationId,
      quantity,
      createdAt: now,
      updatedAt: now,
    });
  },
});
