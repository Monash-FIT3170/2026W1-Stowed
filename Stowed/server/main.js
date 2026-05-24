import { Meteor } from 'meteor/meteor';
import '/imports/api/products/methods';
import '/imports/api/locations/methods';
import '/imports/api/publications';
import '/imports/api/userMethods';
import { ROLES } from '/imports/api/roles';
import '/imports/api/upload.js';
import { Sites, FloorMaps, StorageUnits, StorageLocations } from '/imports/api/locations/collections';
import { Products, ProductRecords } from '/imports/api/products/collections';
import { Organisations } from '/imports/api/organisations';

Meteor.publish('allUsers', async function () {
  if (!this.userId) return this.ready();

  const currentUser = await Meteor.users.findOneAsync(
    this.userId,
    { fields: { 'profile.role': 1, 'profile.organisationId': 1 } }
  );

  if (!currentUser || currentUser.profile.role < ROLES.OWNER) {
    throw new Meteor.Error('unauthorized', 'Owners only');
  }

  // Only users from the same organisation
  return Meteor.users.find(
    { 'profile.organisationId': currentUser.profile.organisationId },
    { fields: { username: 1, emails: 1, 'profile.role': 1 } }
  );
});
