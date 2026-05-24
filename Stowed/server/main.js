import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
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
  let org = await Organisations.findOneAsync({ name: "Monash University" });
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

async function seedProducts(seedOrgId) {
  const count = await Products.find().countAsync();
  if (count > 0) return;

  const now = new Date();
  const add = ({ name, description, category, brand, unitCost, totalQuantity }) =>
    Products.insertAsync({
      orgId: seedOrgId,
      name,
      description,
      category,
      brand,
      unitCost,
      totalQuantity,
      images: [],
      createdAt: now,
      updatedAt: now,
    });

  await add({
    name: "Lab Safety Goggles",
    description: "ANSI-rated chemical splash goggles for laboratory use.",
    category: "Lab Safety",
    brand: "3M",
    unitCost: 12.50,
    totalQuantity: 60,
  });
  await add({
    name: "Nitrile Gloves (Box of 100)",
    description: "Powder-free nitrile examination gloves, medium size.",
    category: "Lab Safety",
    brand: "Ansell",
    unitCost: 18.90,
    totalQuantity: 40,
  });
  await add({
    name: "USB-A to USB-C Cable",
    description: "1.8m braided USB-A to USB-C charging and data cable.",
    category: "IT Accessories",
    brand: "Belkin",
    unitCost: 14.95,
    totalQuantity: 35,
  });
  await add({
    name: "HDMI Cable (2m)",
    description: "High-speed HDMI 2.0 cable for display connections.",
    category: "IT Accessories",
    brand: "Belkin",
    unitCost: 19.95,
    totalQuantity: 28,
  });
  await add({
    name: "Wireless Keyboard",
    description: "Compact wireless keyboard with USB receiver.",
    category: "IT Equipment",
    brand: "Logitech",
    unitCost: 49.00,
    totalQuantity: 15,
  });
  await add({
    name: "Ethernet Patch Cable (Cat6)",
    description: "2m Cat6 RJ45 patch cable for network connections.",
    category: "IT Accessories",
    brand: "Belkin",
    unitCost: 8.50,
    totalQuantity: 50,
  });
  await add({
    name: "Whiteboard Markers (Pack of 12)",
    description: "Assorted colour dry-erase markers with chisel tip.",
    category: "Stationery",
    brand: "Artline",
    unitCost: 11.20,
    totalQuantity: 30,
  });
  await add({
    name: "A4 Copy Paper (Ream)",
    description: "80gsm A4 copy paper, 500 sheets per ream.",
    category: "Stationery",
    brand: "Reflex",
    unitCost: 6.95,
    totalQuantity: 120,
  });
  await add({
    name: "Extension Power Board (6-outlet)",
    description: "6-outlet surge-protected power board with 1.8m cord.",
    category: "Electrical",
    brand: "HPM",
    unitCost: 34.00,
    totalQuantity: 22,
  });
  await add({
    name: "First Aid Kit",
    description: "Workplace first aid kit compliant with AS2675 standards.",
    category: "Health & Safety",
    brand: "St John",
    unitCost: 55.00,
    totalQuantity: 8,
  });
}

async function seedProductRecords() {
  const count = await ProductRecords.find().countAsync();
  if (count > 0) return;

  const [
    goggles, gloves, usbCables, hdmiCables, keyboards,
    ethCables, markers, paper, powerBoards, firstAid,
  ] = await Promise.all([
    Products.findOneAsync({ name: "Lab Safety Goggles" }),
    Products.findOneAsync({ name: "Nitrile Gloves (Box of 100)" }),
    Products.findOneAsync({ name: "USB-A to USB-C Cable" }),
    Products.findOneAsync({ name: "HDMI Cable (2m)" }),
    Products.findOneAsync({ name: "Wireless Keyboard" }),
    Products.findOneAsync({ name: "Ethernet Patch Cable (Cat6)" }),
    Products.findOneAsync({ name: "Whiteboard Markers (Pack of 12)" }),
    Products.findOneAsync({ name: "A4 Copy Paper (Ream)" }),
    Products.findOneAsync({ name: "Extension Power Board (6-outlet)" }),
    Products.findOneAsync({ name: "First Aid Kit" }),
  ]);

  const [sc1, sc2, sc3, it1, it2, it3, sr1, sr2] = await Promise.all([
    StorageLocations.findOneAsync({ code: "SC-A1" }),
    StorageLocations.findOneAsync({ code: "SC-A2" }),
    StorageLocations.findOneAsync({ code: "SC-B1" }),
    StorageLocations.findOneAsync({ code: "IT-R1" }),
    StorageLocations.findOneAsync({ code: "IT-R2" }),
    StorageLocations.findOneAsync({ code: "IT-S1" }),
    StorageLocations.findOneAsync({ code: "SR-A1" }),
    StorageLocations.findOneAsync({ code: "SR-A2" }),
  ]);

  if (!goggles || !sc1) return;

  const now = new Date();
  const rec = (productId, locationId, quantity) =>
    ProductRecords.insertAsync({ productId, locationId, quantity, createdAt: now, updatedAt: now });

  // Lab Safety Goggles: split across science storage (total 60)
  await rec(goggles._id, sc1._id, 35);
  await rec(goggles._id, sc2._id, 25);

  // Nitrile Gloves: science storage (total 40)
  await rec(gloves._id, sc1._id, 20);
  await rec(gloves._id, sc3._id, 20);

  // USB-A to USB-C Cables: IT storage (total 35)
  await rec(usbCables._id, it1._id, 20);
  await rec(usbCables._id, it3._id, 15);

  // HDMI Cables: IT storage (total 28)
  await rec(hdmiCables._id, it1._id, 14);
  await rec(hdmiCables._id, it2._id, 14);

  // Wireless Keyboards: IT storage (total 15)
  await rec(keyboards._id, it2._id, 10);
  await rec(keyboards._id, it3._id, 5);

  // Ethernet Patch Cables: IT storage (total 50)
  await rec(ethCables._id, it1._id, 25);
  await rec(ethCables._id, it2._id, 25);

  // Whiteboard Markers: general storeroom (total 30)
  await rec(markers._id, sr1._id, 18);
  await rec(markers._id, sr2._id, 12);

  // A4 Copy Paper: general storeroom (total 120)
  await rec(paper._id, sr1._id, 70);
  await rec(paper._id, sr2._id, 50);

  // Extension Power Boards: IT and storeroom (total 22)
  await rec(powerBoards._id, it3._id, 10);
  await rec(powerBoards._id, sr1._id, 12);

  // First Aid Kits: spread across locations (total 8)
  await rec(firstAid._id, sc2._id, 3);
  await rec(firstAid._id, sr2._id, 3);
  await rec(firstAid._id, it3._id, 2);
}

async function seedLocations(seedOrgId) {
  const count = await Sites.find().countAsync();
  if (count > 0) return;

  const now = new Date();

  // Single site for the demo
  const siteId = await Sites.insertAsync({
    orgId: seedOrgId,
    name: "Clayton Campus",
    description: "Monash University main campus, Clayton VIC.",
    createdAt: now,
    updatedAt: now,
  });

  // Floor map 1: Science building storeroom
  const scienceFloorId = await FloorMaps.insertAsync({
    orgId: seedOrgId,
    siteId,
    name: "Building 18 – Level 2 Storeroom",
    imageUrl: "",
    createdAt: now,
    updatedAt: now,
  });

  // Floor map 2: IT equipment room
  const itFloorId = await FloorMaps.insertAsync({
    orgId: seedOrgId,
    siteId,
    name: "Building 67 – Ground Floor IT Room",
    imageUrl: "",
    createdAt: now,
    updatedAt: now,
  });

  // Floor map 3: General storeroom
  const generalFloorId = await FloorMaps.insertAsync({
    orgId: seedOrgId,
    siteId,
    name: "Building 3 – Ground Floor Storeroom",
    imageUrl: "",
    createdAt: now,
    updatedAt: now,
  });

  // Science storeroom: Cabinet A and Cabinet B
  const sciCabAId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: scienceFloorId,
    name: "Cabinet A",
    type: "cabinet",
    position: { x: 24, y: 24, width: 100, height: 60 },
    createdAt: now,
    updatedAt: now,
  });
  const sciCabBId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: scienceFloorId,
    name: "Cabinet B",
    type: "cabinet",
    position: { x: 150, y: 24, width: 100, height: 60 },
    createdAt: now,
    updatedAt: now,
  });

  // IT room: Rack 1 and Shelf A
  const itRackId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: itFloorId,
    name: "Equipment Rack 1",
    type: "rack",
    position: { x: 24, y: 24, width: 80, height: 120 },
    createdAt: now,
    updatedAt: now,
  });
  const itShelfId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: itFloorId,
    name: "Shelf A",
    type: "shelf",
    position: { x: 130, y: 24, width: 120, height: 60 },
    createdAt: now,
    updatedAt: now,
  });

  // General storeroom: Shelf A
  const genShelfAId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: generalFloorId,
    name: "Shelf A",
    type: "shelf",
    position: { x: 24, y: 24, width: 160, height: 60 },
    createdAt: now,
    updatedAt: now,
  });

  // Science Cabinet A locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabAId,
    name: "Shelf 1",
    code: "SC-A1",
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabAId,
    name: "Shelf 2",
    code: "SC-A2",
    createdAt: now,
    updatedAt: now,
  });

  // Science Cabinet B locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabBId,
    name: "Shelf 1",
    code: "SC-B1",
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabBId,
    name: "Shelf 2",
    code: "SC-B2",
    createdAt: now,
    updatedAt: now,
  });

  // IT Rack locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: itRackId,
    name: "Bay 1",
    code: "IT-R1",
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: itRackId,
    name: "Bay 2",
    code: "IT-R2",
    createdAt: now,
    updatedAt: now,
  });

  // IT Shelf locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: itShelfId,
    name: "Bay 1",
    code: "IT-S1",
    createdAt: now,
    updatedAt: now,
  });

  // General Shelf A locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: genShelfAId,
    name: "Bay 1",
    code: "SR-A1",
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: genShelfAId,
    name: "Bay 2",
    code: "SR-A2",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedOwner(seedOrgId) {
  const existing = await Meteor.users.findOneAsync({ username: "monash~admin" });
  if (existing) return;

  await Accounts.createUserAsync({
    username: "monash~admin",
    email: "admin@monash.edu",
    password: "monash123",
    profile: {
      role: ROLES.OWNER,
      organisationId: seedOrgId,
      username: "admin",
    },
  });
}

Meteor.startup(async () => {
  await Sites.rawCollection().createIndex({ orgId: 1 });
  await Products.rawCollection().createIndex({ orgId: 1 });

  const seedOrgId = await seedOrg();
  await seedOwner(seedOrgId);
  await seedProducts(seedOrgId);
  await seedLocations(seedOrgId);
  await seedProductRecords();
});

Meteor.publish("allUsers", async function () {
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
