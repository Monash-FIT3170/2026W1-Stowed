import { Meteor } from 'meteor/meteor';

import { Sites, FloorMaps, StorageUnits, StorageLocations } from './locations/collections';
import { Products, ProductRecords } from './products/collections';
import { getCallerOrgId } from './orgAccess';

Meteor.publish('locations.all', async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  const siteIds = (await Sites.find({ orgId }, { fields: { _id: 1 } }).fetchAsync()).map(s => s._id);
  const floorMapIds = (await FloorMaps.find({ siteId: { $in: siteIds } }, { fields: { _id: 1 } }).fetchAsync()).map(f => f._id);
  const storageUnitIds = (await StorageUnits.find({ floorMapId: { $in: floorMapIds } }, { fields: { _id: 1 } }).fetchAsync()).map(u => u._id);

  return [
    Sites.find({ orgId }),
    FloorMaps.find({ siteId: { $in: siteIds } }),
    StorageUnits.find({ floorMapId: { $in: floorMapIds } }),
    StorageLocations.find({ storageUnitId: { $in: storageUnitIds } }),
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
