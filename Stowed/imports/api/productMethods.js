import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Products } from './products';
import { ProductRecords } from './productRecords';

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

    // All stock must be accounted for across assignments.
    const assignedTotal = assignments.reduce((sum, a) => sum + a.quantity, 0);
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

    for (const { locationId, quantity } of assignments) {
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
});
