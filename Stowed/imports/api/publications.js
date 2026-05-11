import { Meteor } from 'meteor/meteor';

import { Sites, FloorMaps, StorageUnits, StorageLocations } from './locations/collections';

import { Products, ProductRecords } from './products/collections';

/**
 * Publishes all location-management data required by the client.
 *
 * This publication supports the location setup flow:
 * Site -> FloorMap -> StorageUnit -> StorageLocation
 *
 * In development, unauthenticated access is allowed so the location UI can be
 * exercised without wiring a full auth flow first.
 *
 * @returns {Mongo.Cursor[]|void} Location-related cursors.
 */
Meteor.publish('locations.all', function () {
  if (!this.userId && !Meteor.isDevelopment) {
    return this.ready();
  }

  return [
    Sites.find(),
    FloorMaps.find(),
    StorageUnits.find(),
    StorageLocations.find(),
  ];
});

Meteor.publish('products', function () {
  if (!this.userId && !Meteor.isDevelopment) {
    return this.ready();
  }

  return Products.find();
});

Meteor.publish('productRecords', function () {
  if (!this.userId && !Meteor.isDevelopment) {
    return this.ready();
  }
  return ProductRecords.find();
});