import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Products } from './products';

Meteor.methods({
  /**
   * Creates a new Product.
   *
   * A Product represents a type of inventory item tracked in the system.
   * Once created, stock can be assigned to specific locations via ProductRecords.
   *
   * @param {Object} params
   * @param {string} params.name - Name of the product.
   * @param {string} [params.description=''] - Optional description of the product.
   * @param {number} params.totalQuantity - Total quantity of stock received.
   * @returns {string} The _id of the newly created product document.
   *
   * @throws {Meteor.Error} not-authorised - If the user is not logged in outside development.
   */
  async 'products.create'({ name, description = '', totalQuantity }) {
    check(name, String);
    check(description, String);
    check(totalQuantity, Match.Integer);

    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const now = new Date();
    return await Products.insertAsync({
      name,
      description,
      totalQuantity,
      createdAt: now,
      updatedAt: now,
    });
  },
});
