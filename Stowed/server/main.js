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

async function seedOrg() {
  let org = await Organisations.findOneAsync({ name: 'Seed Organisation' });
  if (!org) {
    const orgId = await Organisations.insertAsync({
      name: 'Seed Organisation',
      code: 'seed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    org = { _id: orgId };
  }
  return org._id;
}

async function seedProducts(seedOrgId) {
  const count = await Products.find().countAsync();
  if (count > 0) return;

  const now = new Date();
  const add = ({ name, description, totalQuantity }) =>
    Products.insertAsync({ orgId: seedOrgId, name, description, totalQuantity, images: [], createdAt: now, updatedAt: now });

  await add({ name: 'Cardboard Boxes', description: 'Medium-sized cardboard boxes used for general storage and shipping.', totalQuantity: 48 });
  await add({ name: 'Cable Ties',      description: 'Nylon cable ties in assorted sizes for bundling and organising.',   totalQuantity: 23 });
}

async function seedProductRecords() {
  const count = await ProductRecords.find().countAsync();
  if (count > 0) return;

  const cardboardBoxes = await Products.findOneAsync({ name: 'Cardboard Boxes' });
  const handTools = await Products.findOneAsync({ name: 'Cable Ties' });
  const sab1 = await StorageLocations.findOneAsync({ code: 'SA-B1' });
  const sbb1 = await StorageLocations.findOneAsync({ code: 'SB-B1' });

  if (!cardboardBoxes || !handTools || !sab1 || !sbb1) return;

  const now = new Date();
  await ProductRecords.insertAsync({ productId: cardboardBoxes._id, locationId: sab1._id, quantity: 30, createdAt: now, updatedAt: now });
  await ProductRecords.insertAsync({ productId: cardboardBoxes._id, locationId: sbb1._id, quantity: 18, createdAt: now, updatedAt: now });
  await ProductRecords.insertAsync({ productId: handTools._id, locationId: sab1._id, quantity: 15, createdAt: now, updatedAt: now });
  await ProductRecords.insertAsync({ productId: handTools._id, locationId: sbb1._id, quantity: 8,  createdAt: now, updatedAt: now });
}

async function seedLocations(seedOrgId) {
  const count = await Sites.find().countAsync();
  if (count > 0) return;

  const now = new Date();

  const siteId = await Sites.insertAsync({
    orgId: seedOrgId,
    name: 'Main Warehouse',
    description: 'Primary storage facility.',
    createdAt: now,
    updatedAt: now,
  });

  const floorMapId = await FloorMaps.insertAsync({
    orgId: seedOrgId,
    siteId,
    name: 'Ground Floor',
    imageUrl: '',
    createdAt: now,
    updatedAt: now,
  });

  const shelfAId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId,
    name: 'Shelf A',
    type: 'shelf',
    position: { x: 24, y: 24, width: 120, height: 72 },
    createdAt: now,
    updatedAt: now,
  });

  const shelfBId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId,
    name: 'Shelf B',
    type: 'shelf',
    position: { x: 24, y: 120, width: 120, height: 72 },
    createdAt: now,
    updatedAt: now,
  });

  await StorageLocations.insertAsync({ orgId: seedOrgId, storageUnitId: shelfAId, name: 'Bay 1', code: 'SA-B1', createdAt: now, updatedAt: now });
  await StorageLocations.insertAsync({ orgId: seedOrgId, storageUnitId: shelfAId, name: 'Bay 2', code: 'SA-B2', createdAt: now, updatedAt: now });
  await StorageLocations.insertAsync({ orgId: seedOrgId, storageUnitId: shelfBId, name: 'Bay 1', code: 'SB-B1', createdAt: now, updatedAt: now });
  await StorageLocations.insertAsync({ orgId: seedOrgId, storageUnitId: shelfBId, name: 'Bay 2', code: 'SB-B2', createdAt: now, updatedAt: now });
}

Meteor.startup(async () => {
  await Sites.rawCollection().createIndex({ orgId: 1 });
  await Products.rawCollection().createIndex({ orgId: 1 });

  const seedOrgId = await seedOrg();
  await seedProducts(seedOrgId);
  await seedLocations(seedOrgId);
  await seedProductRecords();
});

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
