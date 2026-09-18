import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { ROLES } from "/imports/api/roles";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  MapShapes,
  StorageLocations,
} from "/imports/api/locations/collections";
import { buildRectShape } from "/imports/api/locations/shapeUtils";
import { backfillProductActivities } from "/imports/api/products/activityBackfill";
import { ProductActivities, Products, ProductRecords } from "/imports/api/products/collections";
import { ProductCategories } from "/imports/api/categories/collections";
import { Organisations } from "/imports/api/organisations";
import { ShoppingLists } from "/imports/api/shoppingLists/collections";
import { ADD_PRODUCT_MODES } from "/imports/api/shoppingLists/constants";
import { Schedules } from "/imports/api/schedules/collections";
import { computeNextRunAt } from "/imports/api/schedules/timing";
import { startScheduler } from "/imports/api/schedules/scheduler";
import { PRODUCT_CATALOGUE } from "/imports/api/seedData/products";
import { LOCATION_LAYOUT, PRODUCT_RECORD_PLAN } from "/imports/api/seedData/locations";
import { SHOPPING_LIST_SEEDS } from "/imports/api/seedData/shoppingLists";
import { SCHEDULE_SEEDS } from "/imports/api/seedData/schedules";
import { FAKE_ACCOUNT_SEEDS } from "/imports/api/seedData/users";

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

async function seedFakeAccounts(seedOrgId) {
  for (const account of FAKE_ACCOUNT_SEEDS) {
    const compoundUsername = `monash~${account.username}`;
    const existing = await Meteor.users.findOneAsync({ username: compoundUsername });
    if (existing) continue;

    await Accounts.createUserAsync({
      username: compoundUsername,
      email: account.email,
      password: account.password,
      profile: {
        role: account.role,
        organisationId: seedOrgId,
        username: account.username,
      },
    });
  }
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
  const now = new Date();
  const categoryCache = new Map();

  for (const item of PRODUCT_CATALOGUE) {
    const existing = await Products.findOneAsync({ orgId: seedOrgId, name: item.name });
    if (existing) continue;

    await Products.insertAsync({
      orgId: seedOrgId,
      name: item.name,
      description: item.description,
      categoryId: await seedCategory(seedOrgId, item.category, categoryCache),
      brand: item.brand,
      sku: item.sku,
      unitCost: item.unitCost,
      totalQuantity: item.totalQuantity,
      reorderAt: item.reorderAt,
      images: item.image ? [item.image] : [],
      createdAt: now,
      updatedAt: now,
      updatedByUsername: "System",
    });
  }
}

async function seedLocations(seedOrgId) {
  const now = new Date();

  const monthsAgo = (months) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date;
  };

  let site = await Sites.findOneAsync({ orgId: seedOrgId, name: LOCATION_LAYOUT.site.name });
  if (!site) {
    const siteId = await Sites.insertAsync({
      orgId: seedOrgId,
      ...LOCATION_LAYOUT.site,
      createdAt: now,
      updatedAt: now,
    });
    site = { _id: siteId };
  }
  const siteId = site._id;

  for (const floor of LOCATION_LAYOUT.floors) {
    let floorMap = await FloorMaps.findOneAsync({ orgId: seedOrgId, siteId, name: floor.name });
    if (!floorMap) {
      const floorMapId = await FloorMaps.insertAsync({
        orgId: seedOrgId,
        siteId,
        name: floor.name,
        imageUrl: "",
        createdAt: now,
        updatedAt: now,
      });
      floorMap = { _id: floorMapId };
    }
    const floorMapId = floorMap._id;

    for (const unitDef of floor.units) {
      let unit = await StorageUnits.findOneAsync({
        orgId: seedOrgId,
        floorMapId,
        name: unitDef.name,
      });
      if (!unit) {
        const unitId = await StorageUnits.insertAsync({
          orgId: seedOrgId,
          floorMapId,
          name: unitDef.name,
          type: unitDef.type,
          shape: {
            ...buildRectShape({
              width: unitDef.width,
              height: unitDef.height,
              name: unitDef.name,
            }),
            orgId: seedOrgId,
          },
          offset: { x: unitDef.x, y: unitDef.y },
          rotation: 0,
          scale: { x: 1, y: 1 },
          createdAt: now,
          updatedAt: now,
        });
        unit = { _id: unitId };
      }
      const unitId = unit._id;

      for (const loc of unitDef.locations) {
        const existingLoc = await StorageLocations.findOneAsync({
          orgId: seedOrgId,
          storageUnitId: unitId,
          code: loc.code,
        });
        if (existingLoc) continue;

        await StorageLocations.insertAsync({
          orgId: seedOrgId,
          storageUnitId: unitId,
          name: loc.name,
          code: loc.code,
          lastStocktakeAt: monthsAgo(loc.monthsAgo),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return siteId;
}

async function seedProductRecords() {
  const now = new Date();
  const products = await Products.find().fetchAsync();
  const productsByName = new Map(products.map((p) => [p.name, p]));

  const locations = await StorageLocations.find().fetchAsync();
  const locationsByCode = new Map(locations.map((l) => [l.code, l]));

  for (const [productName, locationCode, quantity] of PRODUCT_RECORD_PLAN) {
    const product = productsByName.get(productName);
    const location = locationsByCode.get(locationCode);
    if (!product || !location) continue;

    const existing = await ProductRecords.findOneAsync({
      productId: product._id,
      locationId: location._id,
    });
    if (existing) continue;

    await ProductRecords.insertAsync({
      productId: product._id,
      locationId: location._id,
      quantity,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function buildListItem(product, seedItem) {
  const { quantityWanted, allocatedDaysAgo, ...overrides } = seedItem;
  delete overrides.productName;
  return {
    productId: product._id,
    productName: product.name,
    sku: product.sku,
    categoryId: product.categoryId ?? "",
    inStock: product.totalQuantity ?? 0,
    reorderAt: product.reorderAt ?? 0,
    lowStockThreshold: 0,
    unitCost: product.unitCost ?? 0,
    quantityWanted,
    addMode: ADD_PRODUCT_MODES.MANUAL,
    purchased: false,
    received: false,
    ...overrides,
    ...(allocatedDaysAgo !== undefined
      ? { allocatedAt: new Date(Date.now() - allocatedDaysAgo * 24 * 60 * 60 * 1000) }
      : {}),
  };
}

async function seedShoppingListsAndSchedules(seedOrgId, siteId) {
  const listCount = await ShoppingLists.find().countAsync();
  const scheduleCount = await Schedules.find().countAsync();
  if (listCount > 0 && scheduleCount > 0) return;

  const admin = await Meteor.users.findOneAsync({ username: "monash~admin" });
  if (!admin) return;

  const products = await Products.find().fetchAsync();
  const byName = new Map(products.map((p) => [p.name, p]));
  const now = new Date();
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  if (listCount === 0) {
    for (const list of SHOPPING_LIST_SEEDS) {
      const { createdDaysAgo, updatedDaysAgo, archivedDaysAgo, items, ...listFields } = list;

      await ShoppingLists.insertAsync({
        orgId: seedOrgId,
        createdBy: admin._id,
        siteId,
        ...listFields,
        items: items.map((item) => buildListItem(byName.get(item.productName), item)),
        ...(archivedDaysAgo !== undefined ? { archivedAt: daysAgo(archivedDaysAgo) } : {}),
        createdAt: daysAgo(createdDaysAgo),
        updatedAt: daysAgo(updatedDaysAgo),
      });
    }
  }

  if (scheduleCount === 0) {
    for (const schedule of SCHEDULE_SEEDS) {
      const { items, ...scheduleFields } = schedule;

      await Schedules.insertAsync({
        orgId: seedOrgId,
        createdBy: admin._id,
        siteId,
        ...scheduleFields,
        ...(items
          ? {
              items: items.map(({ productName, quantityWanted }) => ({
                productId: byName.get(productName)._id,
                quantityWanted,
              })),
            }
          : {}),
        isActive: true,
        nextRunAt: computeNextRunAt(schedule.frequency, now),
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export async function seedDatabase() {
  const seedOrgId = await seedOrg();
  await seedOwner(seedOrgId);
  await seedFakeAccounts(seedOrgId);
  await seedProducts(seedOrgId);
  const siteId = await seedLocations(seedOrgId);
  await seedProductRecords();
  await seedShoppingListsAndSchedules(seedOrgId, siteId);
  await backfillProductActivities(seedOrgId);

  startScheduler();
}

export async function resetDatabase() {
  await Schedules.removeAsync({});
  await ShoppingLists.removeAsync({});
  await ProductActivities.removeAsync({});
  await ProductRecords.removeAsync({});
  await Products.removeAsync({});
  await ProductCategories.removeAsync({});
  await StorageLocations.removeAsync({});
  await StorageUnits.removeAsync({});
  await MapShapes.removeAsync({});
  await FloorMaps.removeAsync({});
  await Sites.removeAsync({});
  await Organisations.removeAsync({});
  await Meteor.users.removeAsync({});
}
