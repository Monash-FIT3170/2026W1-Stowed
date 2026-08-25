import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { WebApp } from "meteor/webapp";
import crypto from "crypto";
import "/imports/api/products/methods";
import "/imports/api/categories/methods";
import "/imports/api/shoppingLists/methods";
import "/imports/api/schedules/methods";
import { startScheduler } from "/imports/api/schedules/scheduler";
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
import { backfillProductActivities } from "/imports/api/products/activityBackfill";
import { ProductActivities, Products, ProductRecords } from "/imports/api/products/collections";
import { buildRectShape } from "/imports/api/locations/shapeUtils";
import { ProductCategories } from "/imports/api/categories/collections";
import { Organisations } from "/imports/api/organisations";

async function seedOrg() {
  let org = await Organisations.findOneAsync({ code: "monash" });
  if (!org) {
    try {
      const orgId = await Organisations.insertAsync({
        name: "Monash University",
        code: "monash",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      org = { _id: orgId };
    } catch (err) {
      if (err && err.code === 11000) {
        org = await Organisations.findOneAsync({ code: "monash" });
      } else {
        throw err;
      }
    }
  }
  return org._id;
}

async function seedCategory(seedOrgId, name, cache) {
  if (cache.has(name)) return cache.get(name);

  let category = await ProductCategories.findOneAsync({ orgId: seedOrgId, name });
  if (!category) {
    const categoryId = await ProductCategories.insertAsync({ orgId: seedOrgId, name });
    category = { _id: categoryId };
  }

  cache.set(name, category._id);
  return category._id;
}

async function seedProducts(seedOrgId) {
  const count = await Products.find().countAsync();
  if (count > 0) return;

  const now = new Date();
  const categoryCache = new Map();

  // `category` is a name used to find or create the ProductCategories document.
  // Only the resulting categoryId is stored on the product.
  const add = async ({
    name,
    description,
    category,
    brand,
    sku,
    unitCost,
    totalQuantity,
    reorderAt,
  }) =>
    Products.insertAsync({
      orgId: seedOrgId,
      name,
      description,
      categoryId: await seedCategory(seedOrgId, category, categoryCache),
      brand,
      sku,
      unitCost,
      totalQuantity,
      reorderAt,
      images: [],
      createdAt: now,
      updatedAt: now,
      updatedByUsername: "System",
    });

  await add({
    name: "Lab Safety Goggles",
    description: "ANSI-rated chemical splash goggles for laboratory use.",
    category: "Lab Safety",
    brand: "3M",
    sku: "PPE-GOG-001",
    unitCost: 12.5,
    totalQuantity: 60,
    reorderAt: 15,
  });
  await add({
    name: "Nitrile Gloves (Box of 100)",
    description: "Powder-free nitrile examination gloves, medium size.",
    category: "Lab Safety",
    brand: "Ansell",
    sku: "PPE-GLV-100M",
    unitCost: 18.9,
    totalQuantity: 40,
    reorderAt: 15,
  });
  await add({
    name: "USB-A to USB-C Cable",
    description: "1.8m braided USB-A to USB-C charging and data cable.",
    category: "IT Accessories",
    brand: "Belkin",
    sku: "CBL-USBC-18",
    unitCost: 14.95,
    totalQuantity: 35,
    reorderAt: 10,
  });
  await add({
    name: "HDMI Cable (2m)",
    description: "High-speed HDMI 2.0 cable for display connections.",
    category: "IT Accessories",
    brand: "Belkin",
    sku: "CBL-HDMI-2M",
    unitCost: 19.95,
    totalQuantity: 28,
    reorderAt: 10,
  });
  await add({
    name: "Wireless Keyboard",
    description: "Compact wireless keyboard with USB receiver.",
    category: "IT Equipment",
    brand: "Logitech",
    sku: "ITE-KBD-WL01",
    unitCost: 49.0,
    totalQuantity: 15,
    reorderAt: 20,
  });
  await add({
    name: "Ethernet Patch Cable (Cat6)",
    description: "2m Cat6 RJ45 patch cable for network connections.",
    category: "IT Accessories",
    brand: "Belkin",
    sku: "CBL-CAT6-2M",
    unitCost: 8.5,
    totalQuantity: 50,
    reorderAt: 20,
  });
  await add({
    name: "Whiteboard Markers (Pack of 12)",
    description: "Assorted colour dry-erase markers with chisel tip.",
    category: "Stationery",
    brand: "Artline",
    sku: "STA-MKR-12",
    unitCost: 11.2,
    totalQuantity: 30,
    reorderAt: 10,
  });
  await add({
    name: "A4 Copy Paper (Ream)",
    description: "80gsm A4 copy paper, 500 sheets per ream.",
    category: "Stationery",
    brand: "Reflex",
    sku: "STA-PPR-A4",
    unitCost: 6.95,
    totalQuantity: 120,
    reorderAt: 40,
  });
  await add({
    name: "Extension Power Board (6-outlet)",
    description: "6-outlet surge-protected power board with 1.8m cord.",
    category: "Electrical",
    brand: "HPM",
    sku: "ELE-PWR-6O",
    unitCost: 34.0,
    totalQuantity: 22,
    reorderAt: 8,
  });
  await add({
    name: "First Aid Kit",
    description: "Workplace first aid kit compliant with AS2675 standards.",
    category: "Health & Safety",
    brand: "St John",
    sku: "HS-FAK-001",
    unitCost: 55.0,
    totalQuantity: 8,
    reorderAt: 10,
  });
}

async function seedProductRecords() {
  const count = await ProductRecords.find().countAsync();
  if (count > 0) return;

  const [
    goggles,
    gloves,
    usbCables,
    hdmiCables,
    keyboards,
    ethCables,
    markers,
    paper,
    powerBoards,
    firstAid,
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
    ProductRecords.insertAsync({
      productId,
      locationId,
      quantity,
      createdAt: now,
      updatedAt: now,
    });

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

  // Spreads seeded stocktake dates across the last 12 months so the demo data
  // shows a realistic mix of recently and overdue counted locations.
  const monthsAgo = (months) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date;
  };

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
    shape: { ...buildRectShape({ width: 2, height: 1.5, name: "Cabinet A" }), orgId: seedOrgId },
    offset: { x: 1, y: 1 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    createdAt: now,
    updatedAt: now,
  });
  const sciCabBId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: scienceFloorId,
    name: "Cabinet B",
    type: "cabinet",
    shape: { ...buildRectShape({ width: 2, height: 1.5, name: "Cabinet B" }), orgId: seedOrgId },
    offset: { x: 4, y: 1 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    createdAt: now,
    updatedAt: now,
  });

  // IT room: Rack 1 and Shelf A
  const itRackId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: itFloorId,
    name: "Equipment Rack 1",
    type: "rack",
    shape: {
      ...buildRectShape({ width: 1.5, height: 2.5, name: "Equipment Rack 1" }),
      orgId: seedOrgId,
    },
    offset: { x: 1, y: 1 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    createdAt: now,
    updatedAt: now,
  });
  const itShelfId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: itFloorId,
    name: "Shelf A",
    type: "shelf",
    shape: { ...buildRectShape({ width: 2.5, height: 1, name: "Shelf A" }), orgId: seedOrgId },
    offset: { x: 3.5, y: 1 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    createdAt: now,
    updatedAt: now,
  });

  // General storeroom: Shelf A
  const genShelfAId = await StorageUnits.insertAsync({
    orgId: seedOrgId,
    floorMapId: generalFloorId,
    name: "Shelf A",
    type: "shelf",
    shape: { ...buildRectShape({ width: 3, height: 1, name: "Shelf A" }), orgId: seedOrgId },
    offset: { x: 1, y: 1 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    createdAt: now,
    updatedAt: now,
  });

  // Science Cabinet A locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabAId,
    name: "Shelf 1",
    code: "SC-A1",
    lastStocktakeAt: monthsAgo(0),
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabAId,
    name: "Shelf 2",
    code: "SC-A2",
    lastStocktakeAt: monthsAgo(1),
    createdAt: now,
    updatedAt: now,
  });

  // Science Cabinet B locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabBId,
    name: "Shelf 1",
    code: "SC-B1",
    lastStocktakeAt: monthsAgo(2),
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: sciCabBId,
    name: "Shelf 2",
    code: "SC-B2",
    lastStocktakeAt: monthsAgo(4),
    createdAt: now,
    updatedAt: now,
  });

  // IT Rack locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: itRackId,
    name: "Bay 1",
    code: "IT-R1",
    lastStocktakeAt: monthsAgo(5),
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: itRackId,
    name: "Bay 2",
    code: "IT-R2",
    lastStocktakeAt: monthsAgo(7),
    createdAt: now,
    updatedAt: now,
  });

  // IT Shelf locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: itShelfId,
    name: "Bay 1",
    code: "IT-S1",
    lastStocktakeAt: monthsAgo(9),
    createdAt: now,
    updatedAt: now,
  });

  // General Shelf A locations
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: genShelfAId,
    name: "Bay 1",
    code: "SR-A1",
    lastStocktakeAt: monthsAgo(11),
    createdAt: now,
    updatedAt: now,
  });
  await StorageLocations.insertAsync({
    orgId: seedOrgId,
    storageUnitId: genShelfAId,
    name: "Bay 2",
    code: "SR-A2",
    lastStocktakeAt: monthsAgo(12),
    createdAt: now,
    updatedAt: now,
  });
}

async function seedOwner(seedOrgId) {
  const existing = await Meteor.users.findOneAsync({
    username: "monash~admin",
  });
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
  await ProductActivities.rawCollection().createIndex({ orgId: 1, createdAt: -1 });

  await seedDatabase();
});

// Runs the full seed sequence. Each step is individually guarded (it no-ops if
// its data already exists), so this is safe to call repeatedly.
async function seedDatabase() {
  const seedOrgId = await seedOrg();
  await seedOwner(seedOrgId);
  await seedProducts(seedOrgId);
  await seedLocations(seedOrgId);
  await seedProductRecords();
  await backfillProductActivities(seedOrgId);

  startScheduler();
}

// Wipes every seeded collection (and all user accounts) so the database can be
// re-seeded from scratch. Destructive - only reachable via the protected
// /admin/reset-seed endpoint below.
async function resetDatabase() {
  await ProductActivities.removeAsync({});
  await ProductRecords.removeAsync({});
  await Products.removeAsync({});
  await ProductCategories.removeAsync({});
  await StorageLocations.removeAsync({});
  await StorageUnits.removeAsync({});
  await FloorMaps.removeAsync({});
  await Sites.removeAsync({});
  await Organisations.removeAsync({});
  await Meteor.users.removeAsync({});
}

// Constant-time string comparison so token checks don't leak via timing.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Protected admin endpoint: POST /admin/reset-seed wipes the DB and reseeds it.
// The route is DISABLED unless a RESET_SEED_TOKEN is configured (Galaxy env var
// or Meteor settings), and requires that token in the `x-reset-token` header.
WebApp.connectHandlers.use("/admin/reset-seed", async (req, res) => {
  const token = process.env.RESET_SEED_TOKEN || Meteor.settings?.RESET_SEED_TOKEN;

  // No token configured -> behave as if the route doesn't exist.
  if (!token) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method Not Allowed");
    return;
  }
  if (!safeEqual(req.headers["x-reset-token"] || "", token)) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  try {
    await resetDatabase();
    await seedDatabase();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "Database reset and reseeded." }));
  } catch (err) {
    console.error("reset-seed failed:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
});

Meteor.publish("allUsers", async function () {
  if (!this.userId) return this.ready();

  const currentUser = await Meteor.users.findOneAsync(this.userId, {
    fields: { "profile.role": 1, "profile.organisationId": 1 },
  });

  if (!currentUser || currentUser.profile.role < ROLES.OWNER) {
    throw new Meteor.Error("unauthorized", "Owners only");
  }

  // Only users from the same organisation
  return Meteor.users.find(
    { "profile.organisationId": currentUser.profile.organisationId },
    {
      fields: {
        username: 1,
        emails: 1,
        "profile.role": 1,
        "profile.username": 1,
      },
    },
  );
});
