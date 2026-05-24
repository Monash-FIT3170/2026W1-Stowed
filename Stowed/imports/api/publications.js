import { Meteor } from 'meteor/meteor';

import { Sites, FloorMaps, StorageUnits, StorageLocations } from './locations/collections';
import { Products, ProductRecords } from './products/collections';
import { getCallerOrgId } from './userMethods';
import { Organisations } from '/imports/api/organisations';

Meteor.publish('locations.all', async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return [
    Sites.find({ orgId }),
    FloorMaps.find({ orgId }),
    StorageUnits.find({ orgId }),
    StorageLocations.find({ orgId }),
  ];
});

Meteor.publish('products', async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return Products.find({ orgId });
});

Meteor.publish('productRecords', async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  const productIds = (await Products.find({ orgId }, { fields: { _id: 1 } }).fetchAsync()).map(p => p._id);

  return ProductRecords.find({ productId: { $in: productIds } });
});

Meteor.publish('currentOrganisation', async function () {
  if (!this.userId) return this.ready();
  const user = await Meteor.users.findOneAsync(
    this.userId,
    { fields: { 'profile.organisationId': 1 } }
  );
  if (!user || !user.profile.organisationId) return this.ready();
  return Organisations.find(user.profile.organisationId);
});
