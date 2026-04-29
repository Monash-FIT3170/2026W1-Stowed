import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { ProductRecords } from './productRecords';

Meteor.methods({
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
