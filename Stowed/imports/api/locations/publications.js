import { Meteor } from 'meteor/meteor';

import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from './collections';

/**
 * Publishes all location-management data required by the client.
 *
 * This publication supports the location setup flow:
 * Site -> FloorMap -> StorageUnit -> StorageLocation
 *
 * Only authenticated users can access location data. If the user is not
 * logged in, no documents are published.
 *
 * @returns {Mongo.Cursor[]|void} Location-related cursors for authenticated users.
 */
Meteor.publish('locations.all', function () {
  if (!this.userId) {
    return this.ready();
  }

  return [
    Sites.find(),
    FloorMaps.find(),
    StorageUnits.find(),
    StorageLocations.find(),
  ];
});