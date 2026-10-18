import assert from "assert";
import { Meteor } from "meteor/meteor";
import { Organisations } from "../imports/api/organisations";
import { Products, ProductRecords } from "../imports/api/products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
  FloorMapRoutes,
} from "../imports/api/locations/collections";
import { ROLES } from "../imports/api/roles";
import { resolveDirections, DIRECTIONS_CHOICE_KINDS } from "../imports/api/chatbot/directions";
import { describeServer } from "./serverOnly";

const ORG = "dir-test-org";
const USER = "dir-test-user";
const ids = (suffix) => `dir-test-${suffix}`;

describeServer("Chatbot directions resolver", function () {
  const now = new Date();
  const sites = ["north", "south"];

  async function cleanup() {
    await Meteor.users.removeAsync(USER);
    await Organisations.removeAsync(ORG);
    await Sites.removeAsync({ orgId: ORG });
    await FloorMaps.removeAsync({ orgId: ORG });
    await StorageUnits.removeAsync({ orgId: ORG });
    await StorageLocations.removeAsync({ orgId: ORG });
    await FloorMapRoutes.removeAsync({ orgId: ORG });
    const products = await Products.find({ orgId: ORG }).fetchAsync();
    await ProductRecords.removeAsync({ productId: { $in: products.map((p) => p._id) } });
    await Products.removeAsync({ orgId: ORG });
  }

  async function addProduct(suffix, name, stockedAt = []) {
    const _id = ids(suffix);
    await Products.insertAsync({
      _id,
      orgId: ORG,
      name,
      totalQuantity: 1,
      unitCost: 1,
      purchaseCost: 1,
      createdAt: now,
      updatedAt: now,
    });
    for (const site of stockedAt) {
      await ProductRecords.insertAsync({
        productId: _id,
        locationId: ids(`loc-${site}`),
        quantity: 3,
        createdAt: now,
        updatedAt: now,
      });
    }
    return _id;
  }

  before(async function () {
    await cleanup();
    await Organisations.insertAsync({
      _id: ORG,
      name: ORG,
      code: ORG,
      createdAt: now,
      updatedAt: now,
    });
    await Meteor.users.insertAsync({
      _id: USER,
      username: `${ORG}~${USER}`,
      emails: [{ address: `${USER}@test.com`, verified: true }],
      profile: { organisationId: ORG, role: ROLES.STANDARD, username: USER },
    });
    for (const site of sites) {
      await Sites.insertAsync({
        _id: ids(`site-${site}`),
        orgId: ORG,
        name: site,
        description: "",
        createdAt: now,
        updatedAt: now,
      });
      await FloorMaps.insertAsync({
        _id: ids(`floor-${site}`),
        orgId: ORG,
        siteId: ids(`site-${site}`),
        name: `${site} floor`,
        createdAt: now,
        updatedAt: now,
      });
      await StorageUnits.insertAsync({
        _id: ids(`unit-${site}`),
        orgId: ORG,
        floorMapId: ids(`floor-${site}`),
        name: "Shelf",
        type: "shelf",
        shape: {
          orgId: ORG,
          shapeId: 0,
          name: "s",
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 0 },
          ],
          gridReference: { x: 0, y: 0 },
        },
        offset: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        createdAt: now,
        updatedAt: now,
      });
      await StorageLocations.insertAsync({
        _id: ids(`loc-${site}`),
        orgId: ORG,
        storageUnitId: ids(`unit-${site}`),
        name: "Bay",
        code: `DIR-${site}`,
        storedItems: [],
        lastStocktakeAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await FloorMapRoutes.insertAsync({
        orgId: ORG,
        floorMapId: ids(`floor-${site}`),
        nodes: [
          { id: "a", x: 1, y: 1, type: "product", storageLocationIds: [ids(`loc-${site}`)] },
        ],
        links: [],
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  afterEach(async function () {
    await ProductRecords.removeAsync({ productId: { $regex: "^dir-test-p" } });
    await Products.removeAsync({ orgId: ORG });
  });

  after(cleanup);

  it("reports a product that does not exist", async function () {
    const result = await resolveDirections({ userId: USER, productQueries: ["Unicorn Tears"] });
    assert.strictEqual(result.status, "not_found");
    assert.deepStrictEqual(result.actions, []);
  });

  it("asks which product the user wants when none was named", async function () {
    const result = await resolveDirections({ userId: USER });
    assert.strictEqual(result.status, "need_products");
  });

  it("says so when the product has no stock on a routed floor", async function () {
    await addProduct("p-none", "Dusty Jar");
    const result = await resolveDirections({ userId: USER, productQueries: ["Dusty Jar"] });
    assert.strictEqual(result.status, "unavailable");
  });

  it("opens the map straight away for a single product on a single floor", async function () {
    const id = await addProduct("p-milk", "Oat Milk", ["north"]);
    const result = await resolveDirections({ userId: USER, productQueries: ["Oat Milk"] });

    assert.strictEqual(result.status, "directions_opened");
    const [action] = result.actions;
    assert.strictEqual(action.type, "directions");
    assert.strictEqual(action.floorMapId, ids("floor-north"));
    assert.strictEqual(action.siteName, "north");
    assert.deepStrictEqual(action.productIds, [id]);
    assert.strictEqual(action.productNames[id], "Oat Milk");
    assert.strictEqual(action.floors.length, 1);
  });

  it("asks which floor when several cover the product equally", async function () {
    await addProduct("p-tea", "Green Tea", ["north", "south"]);
    const result = await resolveDirections({ userId: USER, productQueries: ["Green Tea"] });

    assert.strictEqual(result.status, "choice_shown");
    const [choice] = result.actions;
    assert.strictEqual(choice.kind, DIRECTIONS_CHOICE_KINDS.FLOOR);
    assert.deepStrictEqual(choice.options.map((o) => o.value).sort(), [
      ids("floor-north"),
      ids("floor-south"),
    ]);
  });

  it("opens the chosen floor and lists the others so the map can switch", async function () {
    await addProduct("p-rice", "Jasmine Rice", ["north", "south"]);
    const result = await resolveDirections({
      userId: USER,
      productQueries: ["Jasmine Rice"],
      floorMapId: ids("floor-south"),
    });

    assert.strictEqual(result.status, "directions_opened");
    const [action] = result.actions;
    assert.strictEqual(action.floorMapId, ids("floor-south"));
    assert.strictEqual(action.floors.length, 2);
  });

  it("asks for the site before the product when matches are stocked at several sites", async function () {
    await addProduct("p-a", "Tinned Beans Red", ["north"]);
    await addProduct("p-b", "Tinned Beans White", ["south"]);
    const result = await resolveDirections({ userId: USER, productQueries: ["Tinned Beans"] });

    assert.strictEqual(result.status, "choice_shown");
    const [choice] = result.actions;
    assert.strictEqual(choice.kind, DIRECTIONS_CHOICE_KINDS.SITE);
    assert.strictEqual(choice.multiSelect, false);
    assert.strictEqual(choice.options.length, 2);
  });

  it("only offers the products stocked at the chosen site", async function () {
    await addProduct("p-a", "Tinned Beans Red", ["north"]);
    await addProduct("p-b", "Tinned Beans White", ["north"]);
    await addProduct("p-c", "Tinned Beans Black", ["south"]);
    const result = await resolveDirections({
      userId: USER,
      productQueries: ["Tinned Beans"],
      siteId: ids("site-north"),
    });

    assert.strictEqual(result.status, "choice_shown");
    const [choice] = result.actions;
    assert.strictEqual(choice.kind, DIRECTIONS_CHOICE_KINDS.PRODUCTS);
    assert.strictEqual(choice.multiSelect, true);
    assert.deepStrictEqual(choice.options.map((o) => o.value).sort(), [ids("p-a"), ids("p-b")]);
  });

  it("ignores products belonging to another organisation", async function () {
    await Products.insertAsync({
      _id: ids("p-foreign"),
      orgId: "dir-test-other-org",
      name: "Foreign Gadget",
      totalQuantity: 1,
      unitCost: 1,
      purchaseCost: 1,
      createdAt: now,
      updatedAt: now,
    });
    const result = await resolveDirections({ userId: USER, productQueries: ["Foreign Gadget"] });
    await Products.removeAsync(ids("p-foreign"));
    assert.strictEqual(result.status, "not_found");
  });
});
