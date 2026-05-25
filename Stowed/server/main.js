import { Meteor } from "meteor/meteor";
import "/imports/api/products/methods";
import "/imports/api/locations/methods";
import "/imports/api/publications";
import "/imports/api/userMethods";
import { ROLES } from "/imports/api/roles";
import "/imports/api/upload.js";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "/imports/api/locations/collections";
import { Products, ProductRecords } from "/imports/api/products/collections";
import { Organisations } from "/imports/api/organisations";

async function seedOrg() {
  let org = await Organisations.findOneAsync({ code: "monash" });
  if (!org) {
    const orgId = await Organisations.insertAsync({
      name: "Monash University",
      code: "monash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    org = { _id: orgId };
  }
  return org._id;
}

async function seedProducts() {
  const count = await Products.find().countAsync();
  if (count > 0) return;

  const now = new Date();
  const add = ({ name, description, totalQuantity }) =>
    Products.insertAsync({
      name,
      description,
      totalQuantity,
      images: [],
      createdAt: now,
      updatedAt: now,
    });

  await add({
    name: "Cardboard Boxes",
    description:
      "Medium-sized cardboard boxes used for general storage and shipping.",
    totalQuantity: 48,
  });
  await add({
    name: "Cable Ties",
    description:
      "Nylon cable ties in assorted sizes for bundling and organising.",
    totalQuantity: 23,
  });
}

async function seedProductRecords() {
  const count = await ProductRecords.find().countAsync();
  if (count > 0) return;

  const cardboardBoxes = await Products.findOneAsync({
    name: "Cardboard Boxes",
  });
  const handTools = await Products.findOneAsync({ name: "Cable Ties" });
  const sab1 = await StorageLocations.findOneAsync({ code: "SA-B1" });
  const sbb1 = await StorageLocations.findOneAsync({ code: "SB-B1" });

  if (!cardboardBoxes || !handTools || !sab1 || !sbb1) return;

  const now = new Date();
  // Cardboard Boxes: 30 at SA-B1, 18 at SB-B1 (total: 48)
  await ProductRecords.insertAsync({
    productId: cardboardBoxes._id,
    locationId: sab1._id,
    quantity: 30,
    createdAt: now,
    updatedAt: now,
  });
  await ProductRecords.insertAsync({
    productId: cardboardBoxes._id,
    locationId: sbb1._id,
    quantity: 18,
    createdAt: now,
    updatedAt: now,
  });
  // Hand Tools: 15 at SA-B1, 8 at SB-B1 (total: 23)
  await ProductRecords.insertAsync({
    productId: handTools._id,
    locationId: sab1._id,
    quantity: 15,
    createdAt: now,
    updatedAt: now,
  });
  await ProductRecords.insertAsync({
    productId: handTools._id,
    locationId: sbb1._id,
    quantity: 8,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedLocations() {
  const count = await Sites.find().countAsync();
  if (count > 0) return;

  const now = new Date();

  const siteId = await Sites.insertAsync({
    name: "Main Warehouse",
    description: "Primary storage facility.",
    createdAt: now,
    updatedAt: now,
  });

  const floorMapId = await FloorMaps.insertAsync({
    siteId,
    name: "Ground Floor",
    imageUrl: "",
    createdAt: now,
    updatedAt: now,
  });

  const shelfAId = await StorageUnits.insertAsync({
    floorMapId,
    name: "Shelf A",
    type: "shelf",
    position: { x: 24, y: 24, width: 120, height: 72 },
    createdAt: now,
    updatedAt: now,
  });

  const shelfBId = await StorageUnits.insertAsync({
    floorMapId,
    name: "Shelf B",
    type: "shelf",
    position: { x: 24, y: 120, width: 120, height: 72 },
    createdAt: now,
    updatedAt: now,
  });

  await StorageLocations.insertAsync({
    storageUnitId: shelfAId,
    name: "Bay 1",
    code: "SA-B1",
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    storageUnitId: shelfAId,
    name: "Bay 2",
    code: "SA-B2",
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    storageUnitId: shelfBId,
    name: "Bay 1",
    code: "SB-B1",
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    storageUnitId: shelfBId,
    name: "Bay 2",
    code: "SB-B2",
    createdAt: now,
    updatedAt: now,
  });
}

// Publications

Meteor.startup(async () => {
  await seedProducts();
  await seedLocations();
  await seedProductRecords();
});

Meteor.publish("allUsers", async function () {
  // allow only if the logged-in user has owner role
  if (!this.userId) return this.ready();
  const user = await Meteor.users.findOneAsync(this.userId, {
    fields: { "profile.role": 1 },
  });

  if (!user || user.profile.role < ROLES.OWNER) {
    throw new Meteor.Error("unauthorized", "Owners only");
  }
  return Meteor.users.find({}, { fields: { username: 1, emails: 1 } });
});
