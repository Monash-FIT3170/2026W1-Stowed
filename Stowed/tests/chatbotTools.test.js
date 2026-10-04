import assert from "assert";
import { Meteor } from "meteor/meteor";
import { Organisations } from "../imports/api/organisations";
import { Products, ProductRecords } from "../imports/api/products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "../imports/api/locations/collections";
import { hasClientPermission } from "../imports/api/userMethods";
import { ROLES } from "../imports/api/roles";
import "../imports/api/products/methods";
import {
  buildToolDeclarations,
  executeTool,
  clearPendingActions,
} from "../imports/api/chatbot/tools";
import { describeServer } from "./serverOnly";

const ORG = "chatbot-test-org";
const OTHER_ORG = "chatbot-test-other-org";
const STANDARD_ID = "chatbot-test-standard";
const ADMIN_ID = "chatbot-test-admin";
const SITE = "chatbot-test-site";
const FLOOR_MAP = "chatbot-test-floormap";
const UNIT = "chatbot-test-unit";
const LOCATION = "chatbot-test-location";
const OTHER_PRODUCT = "chatbot-test-other-product";

const names = (tools) => tools.map((tool) => tool.name).sort();
const toolsFor = (role) =>
  buildToolDeclarations((permission) => hasClientPermission(role, permission));

describe("Chatbot tool declarations", function () {
  it("gives a standard user read tools and navigation but no write tools", function () {
    const tools = toolsFor(ROLES.STANDARD);
    assert.deepStrictEqual(names(tools), ["getProduct", "navigate", "searchProducts"]);
  });

  it("gives an admin the product CRUD tools", function () {
    const tools = names(toolsFor(ROLES.ADMIN));
    for (const name of ["createProduct", "updateProduct", "deleteProduct", "listLocations"]) {
      assert.ok(tools.includes(name), `admin should have ${name}`);
    }
  });

  it("only offers pages the role can open", function () {
    const pagesFor = (role) =>
      toolsFor(role).find((tool) => tool.name === "navigate").parameters.properties.page.enum;

    assert.ok(!pagesFor(ROLES.STANDARD).includes("accounts"));
    assert.ok(!pagesFor(ROLES.STANDARD).includes("add_product"));
    assert.ok(pagesFor(ROLES.ADMIN).includes("add_product"));
    assert.ok(!pagesFor(ROLES.ADMIN).includes("accounts"));
    assert.ok(pagesFor(ROLES.OWNER).includes("accounts"));
  });
});

describeServer("Chatbot tool execution", function () {
  const standardAllowed = new Set(names(toolsFor(ROLES.STANDARD)));
  const adminAllowed = new Set(names(toolsFor(ROLES.ADMIN)));
  let turn = 0;

  const run = (userId, allowed, toolName, args, actions = []) =>
    executeTool({ userId, toolName, args, turn, allowedToolNames: allowed, actions });

  async function cleanup() {
    await Meteor.users.removeAsync({ _id: { $in: [STANDARD_ID, ADMIN_ID] } });
    await Organisations.removeAsync({ _id: { $in: [ORG, OTHER_ORG] } });
    await Sites.removeAsync(SITE);
    await FloorMaps.removeAsync(FLOOR_MAP);
    await StorageUnits.removeAsync(UNIT);
    await StorageLocations.removeAsync(LOCATION);
    const products = await Products.find({ orgId: { $in: [ORG, OTHER_ORG] } }).fetchAsync();
    await ProductRecords.removeAsync({ productId: { $in: products.map((p) => p._id) } });
    await Products.removeAsync({ orgId: { $in: [ORG, OTHER_ORG] } });
  }

  before(async function () {
    await cleanup();
    const now = new Date();
    for (const _id of [ORG, OTHER_ORG]) {
      await Organisations.insertAsync({
        _id,
        name: _id,
        code: _id,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const [_id, role] of [
      [STANDARD_ID, ROLES.STANDARD],
      [ADMIN_ID, ROLES.ADMIN],
    ]) {
      await Meteor.users.insertAsync({
        _id,
        username: `${ORG}~${_id}`,
        emails: [{ address: `${_id}@test.com`, verified: true }],
        profile: { organisationId: ORG, role, username: _id },
      });
    }
    await Sites.insertAsync({
      _id: SITE,
      orgId: ORG,
      name: "Site",
      description: "",
      createdAt: now,
      updatedAt: now,
    });
    await FloorMaps.insertAsync({
      _id: FLOOR_MAP,
      orgId: ORG,
      siteId: SITE,
      name: "Map",
      createdAt: now,
      updatedAt: now,
    });
    await StorageUnits.insertAsync({
      _id: UNIT,
      orgId: ORG,
      floorMapId: FLOOR_MAP,
      name: "Shelf A",
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
      _id: LOCATION,
      orgId: ORG,
      storageUnitId: UNIT,
      name: "Bay 1",
      code: "CB-1",
      storedItems: [],
      lastStocktakeAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await Products.insertAsync({
      _id: OTHER_PRODUCT,
      orgId: OTHER_ORG,
      name: "Secret Other Org Widget",
      totalQuantity: 1,
      unitCost: 1,
      purchaseCost: 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  beforeEach(function () {
    clearPendingActions();
    turn += 10;
  });

  after(cleanup);

  const newProduct = () => ({
    name: `Chat Widget ${Math.random().toString(36).slice(2, 8)}`,
    totalQuantity: 5,
    locationId: LOCATION,
    unitCost: 12,
  });

  it("refuses write tools a standard user was never given", async function () {
    const result = await run(STANDARD_ID, standardAllowed, "deleteProduct", {
      productId: OTHER_PRODUCT,
      confirmed: true,
    });
    assert.ok(result.error);
    assert.ok(await Products.findOneAsync(OTHER_PRODUCT));
  });

  it("does not create a product until the user confirms on a later turn", async function () {
    const args = newProduct();

    const proposed = await run(ADMIN_ID, adminAllowed, "createProduct", args);
    assert.strictEqual(proposed.status, "confirmation_required");

    // Model tries to self-confirm within the same turn: still blocked.
    const sameTurn = await run(ADMIN_ID, adminAllowed, "createProduct", {
      ...args,
      confirmed: true,
    });
    assert.strictEqual(sameTurn.status, "confirmation_required");
    assert.strictEqual(await Products.find({ name: args.name }).countAsync(), 0);

    turn += 1;
    const created = await run(ADMIN_ID, adminAllowed, "createProduct", {
      ...args,
      confirmed: true,
    });
    assert.strictEqual(created.status, "created");

    const product = await Products.findOneAsync(created.productId);
    assert.strictEqual(product.orgId, ORG);
    assert.strictEqual(product.totalQuantity, 5);
    const records = await ProductRecords.find({ productId: created.productId }).fetchAsync();
    assert.deepStrictEqual(
      records.map((r) => [r.locationId, r.quantity]),
      [[LOCATION, 5]],
    );
  });

  it("will not confirm a different action than the one proposed", async function () {
    const proposed = newProduct();
    await run(ADMIN_ID, adminAllowed, "createProduct", proposed);

    turn += 1;
    const swapped = await run(ADMIN_ID, adminAllowed, "createProduct", {
      ...proposed,
      totalQuantity: 500,
      confirmed: true,
    });
    assert.strictEqual(swapped.status, "confirmation_required");
  });

  it("updates details without wiping images or the stock split", async function () {
    const args = newProduct();
    await run(ADMIN_ID, adminAllowed, "createProduct", args);
    turn += 1;
    const { productId } = await run(ADMIN_ID, adminAllowed, "createProduct", {
      ...args,
      confirmed: true,
    });
    await Products.updateAsync(productId, {
      $set: { images: ["/img/a.png"], photoUrl: "/img/a.png", qrCode: "QR-KEEP" },
    });

    turn += 1;
    const change = { productId, brand: "Acme" };
    await run(ADMIN_ID, adminAllowed, "updateProduct", change);
    turn += 1;
    const updated = await run(ADMIN_ID, adminAllowed, "updateProduct", {
      ...change,
      confirmed: true,
    });
    assert.strictEqual(updated.status, "updated");

    const product = await Products.findOneAsync(productId);
    assert.strictEqual(product.brand, "Acme");
    assert.strictEqual(product.name, args.name);
    assert.deepStrictEqual(product.images, ["/img/a.png"]);
    assert.strictEqual(product.qrCode, "QR-KEEP");
    assert.strictEqual(product.totalQuantity, 5);
    assert.strictEqual(await ProductRecords.find({ productId }).countAsync(), 1);
  });

  it("deletes after confirmation, and never another organisation's product", async function () {
    const args = newProduct();
    await run(ADMIN_ID, adminAllowed, "createProduct", args);
    turn += 1;
    const { productId } = await run(ADMIN_ID, adminAllowed, "createProduct", {
      ...args,
      confirmed: true,
    });

    turn += 1;
    await run(ADMIN_ID, adminAllowed, "deleteProduct", { productId });
    turn += 1;
    const deleted = await run(ADMIN_ID, adminAllowed, "deleteProduct", {
      productId,
      confirmed: true,
    });
    assert.strictEqual(deleted.status, "deleted");
    assert.strictEqual(await Products.findOneAsync(productId), undefined);

    turn += 1;
    await run(ADMIN_ID, adminAllowed, "deleteProduct", { productId: OTHER_PRODUCT });
    turn += 1;
    const crossOrg = await run(ADMIN_ID, adminAllowed, "deleteProduct", {
      productId: OTHER_PRODUCT,
      confirmed: true,
    });
    assert.ok(crossOrg.error);
    assert.ok(await Products.findOneAsync(OTHER_PRODUCT));
  });

  it("only searches the caller's own organisation", async function () {
    const result = await run(STANDARD_ID, standardAllowed, "searchProducts", { query: "Widget" });
    assert.ok(!result.products.some((p) => p.name.includes("Secret Other Org")));
  });

  it("lists products with no query and can filter to low stock", async function () {
    const now = new Date();
    await Products.insertAsync({
      _id: "chatbot-test-low",
      orgId: ORG,
      name: "Chat Low Item",
      totalQuantity: 2,
      reorderAt: 5,
      unitCost: 1,
      purchaseCost: 1,
      createdAt: now,
      updatedAt: now,
    });

    const all = await run(STANDARD_ID, standardAllowed, "searchProducts", {});
    assert.ok(all.products.some((p) => p.id === "chatbot-test-low"));
    assert.ok(!all.products.some((p) => p.id === OTHER_PRODUCT));

    const low = await run(STANDARD_ID, standardAllowed, "searchProducts", { lowStockOnly: true });
    assert.deepStrictEqual(
      low.products.map((p) => p.id),
      ["chatbot-test-low"],
    );
  });

  it("navigates only to pages the role may open", async function () {
    const actions = [];
    const ok = await run(STANDARD_ID, standardAllowed, "navigate", { page: "inventory" }, actions);
    assert.deepStrictEqual(actions, [{ type: "navigate", path: "/inventory" }]);
    assert.strictEqual(ok.status, "navigating");

    const blockedActions = [];
    const blocked = await run(
      STANDARD_ID,
      standardAllowed,
      "navigate",
      { page: "accounts" },
      blockedActions,
    );
    assert.ok(blocked.error);
    assert.deepStrictEqual(blockedActions, []);

    const crossOrg = await run(
      ADMIN_ID,
      adminAllowed,
      "navigate",
      { page: "product_detail", productId: OTHER_PRODUCT },
      blockedActions,
    );
    assert.ok(crossOrg.error);
    assert.deepStrictEqual(blockedActions, []);
  });
});
