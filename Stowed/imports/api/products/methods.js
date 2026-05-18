import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Products, ProductRecords } from './collections';
import { Sites, FloorMaps, StorageUnits, StorageLocations } from '../locations/collections';
import { getCallerOrgId, assertOrgAccess } from '../orgAccess';

// Traverses StorageLocation → StorageUnit → FloorMap → Site and asserts org access.
async function assertLocationOrgAccess(locationId, userId) {
  const storageLocation = await StorageLocations.findOneAsync(locationId);
  if (!storageLocation) throw new Meteor.Error('not-found', 'Storage location not found.');
  const storageUnit = await StorageUnits.findOneAsync(storageLocation.storageUnitId);
  if (!storageUnit) throw new Meteor.Error('not-found', 'Storage unit not found.');
  const floorMap = await FloorMaps.findOneAsync(storageUnit.floorMapId);
  if (!floorMap) throw new Meteor.Error('not-found', 'Floor map not found.');
  await assertOrgAccess(Sites, floorMap.siteId, userId);
}

Meteor.methods({
  async 'products.createWithAssignments'({ name, description = '', totalQuantity, assignments }) {
    check(name, String);
    check(description, String);
    check(totalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    if (!this.userId) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    const orgId = await getCallerOrgId(this.userId);
    if (!orgId) throw new Meteor.Error('no-org', 'Your account is not linked to an organisation.');

    const existing = await Products.findOneAsync({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new Meteor.Error('duplicate-name', `A product named "${name}" already exists.`);
    }

    const assignedTotal = assignments.reduce((sum, a) => sum + a.quantity, 0);
    if (assignedTotal !== totalQuantity) {
      throw new Meteor.Error(
        'quantity-mismatch',
        `Assigned quantity (${assignedTotal}) must equal total quantity (${totalQuantity}).`
      );
    }

    const now = new Date();
    const productId = await Products.insertAsync({
      orgId,
      name,
      description,
      totalQuantity,
      createdAt: now,
      updatedAt: now,
    });

    for (const { locationId, quantity } of assignments) {
      await assertLocationOrgAccess(locationId, this.userId);
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

  async 'products.update'({ productId, name, description = '', totalQuantity, assignments }) {
    check(productId, String);
    check(name, String);
    check(description, String);
    check(totalQuantity, Match.Integer);
    check(assignments, [{ locationId: String, quantity: Match.Integer }]);

    await assertOrgAccess(Products, productId, this.userId);

    const existing = await Products.findOneAsync({
      _id: { $ne: productId },
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new Meteor.Error('duplicate-name', `A product named "${name}" already exists.`);
    }

    const assignedTotal = assignments.reduce((sum, a) => sum + a.quantity, 0);
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

    await ProductRecords.removeAsync({ productId });
    for (const { locationId, quantity } of assignments) {
      await assertLocationOrgAccess(locationId, this.userId);
      await ProductRecords.insertAsync({ productId, locationId, quantity, createdAt: now, updatedAt: now });
    }
  },

  async 'products.delete'({ productId }) {
    check(productId, String);

    await assertOrgAccess(Products, productId, this.userId);

    await ProductRecords.removeAsync({ productId });
    await Products.removeAsync(productId);
  },

  async 'productRecords.create'({ productId, locationId, quantity }) {
    check(productId, String);
    check(locationId, String);
    check(quantity, Match.Integer);

    await assertOrgAccess(Products, productId, this.userId);
    await assertLocationOrgAccess(locationId, this.userId);

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
