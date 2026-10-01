import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import {
  Sites,
  FloorMaps,
  MapShapes,
  StorageUnits,
  StorageLocations,
} from "./locations/collections";
import { ProductActivities, Products, ProductRecords } from "./products/collections";
import { ProductCategories } from "./categories/collections.js";
import { ImportRecords } from "./importRecords/collections";
import { getCallerOrgId } from "./userMethods";
import { Organisations } from "/imports/api/organisations";
import { ShoppingLists } from "./shoppingLists/collections";
import { Schedules } from "./schedules/collections";

Meteor.publish("locations.all", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return [
    Sites.find({ orgId }),
    FloorMaps.find({ orgId }),
    StorageUnits.find({ orgId }),
    StorageLocations.find({ orgId }),
    MapShapes.find({ orgId }),
  ];
});

// Anonymous visitors arrive through /org/:orgCode. Publish only the geometry
// needed to draw that organisation's public maps; locations and stock never
// leave the server through this subscription.
Meteor.publish("locations.publicFloorMaps", async function (orgCode) {
  check(orgCode, String);
  const code = orgCode.trim().toLowerCase();
  if (!code) return this.ready();
  const org = await Organisations.findOneAsync({ code }, { fields: { _id: 1 } });
  if (!org) return this.ready();

  const maps = await FloorMaps.find(
    { orgId: org._id, isPrivate: { $ne: true } },
    { fields: { siteId: 1, name: 1, floorSize: 1, isPrivate: 1, createdAt: 1 } },
  ).fetchAsync();
  const mapIds = maps.map((map) => map._id);
  const siteIds = [...new Set(maps.map((map) => map.siteId))];
  return [
    Sites.find({ _id: { $in: siteIds }, orgId: org._id }, { fields: { name: 1, createdAt: 1 } }),
    FloorMaps.find(
      { _id: { $in: mapIds }, orgId: org._id, isPrivate: { $ne: true } },
      { fields: { siteId: 1, name: 1, floorSize: 1, isPrivate: 1, createdAt: 1 } },
    ),
    StorageUnits.find(
      { orgId: org._id, floorMapId: { $in: mapIds } },
      {
        fields: {
          floorMapId: 1,
          name: 1,
          type: 1,
          "shape.points": 1,
          offset: 1,
          rotation: 1,
          scale: 1,
          fill: 1,
        },
      },
    ),
  ];
});

Meteor.publish("products", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return Products.find({ orgId });
});

Meteor.publish("productCategories", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return ProductCategories.find({ orgId });
});

Meteor.publish("productRecords", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  const productIds = (await Products.find({ orgId }, { fields: { _id: 1 } }).fetchAsync()).map(
    (p) => p._id,
  );

  return ProductRecords.find({ productId: { $in: productIds } });
});

Meteor.publish("productActivities", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return ProductActivities.find({ orgId }, { sort: { createdAt: -1 }, limit: 100 });
});

Meteor.publish("importRecords", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return ImportRecords.find({ orgId }, { sort: { createdAt: -1 }, limit: 10 });
});

Meteor.publish("currentOrganisation", async function () {
  if (!this.userId) return this.ready();
  const user = await Meteor.users.findOneAsync(this.userId, {
    fields: { "profile.organisationId": 1 },
  });
  if (!user || !user.profile.organisationId) return this.ready();
  return Organisations.find(user.profile.organisationId);
});

Meteor.publish("shoppingLists", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return ShoppingLists.find({ orgId });
});

Meteor.publish("schedules", async function () {
  if (!this.userId) return this.ready();
  const orgId = await getCallerOrgId(this.userId);
  if (!orgId) return this.ready();

  return Schedules.find({ orgId });
});
