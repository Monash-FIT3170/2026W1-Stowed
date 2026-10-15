import assert from "assert";
import { Meteor } from "meteor/meteor";
import { describeServer } from "./serverOnly";
import {
  Sites,
  FloorMaps,
  FloorMapRoutes,
  StorageUnits,
  StorageLocations,
} from "../imports/api/locations/collections";
import { Organisations } from "../imports/api/organisations";
import "../imports/api/locations/methods";

// Separate ids from locationMethods.test.js so the two suites' fixtures never collide
const USER_ID = "route-test-user-id";
const OTHER_ORG_USER_ID = "route-test-other-user-id";
const ORG_ID = "route-test-org-id";
const OTHER_ORG_ID = "route-test-other-org-id";
const SITE_ID = "route-test-site-id";
const FLOOR_MAP_ID = "route-test-floor-map-id";
const STORAGE_UNIT_ID = "route-test-unit-id";
const STORAGE_LOCATION_ID = "route-test-location-id";
const OWNER_ROLE = 3; // ROLES.OWNER - passes all permission checks

const NODES = [
  { id: "n1", x: 1, y: 1 },
  { id: "n2", x: 3, y: 1 },
  { id: "n3", x: 3, y: 4 },
];
const LINKS = [
  { id: "l1", fromId: "n1", toId: "n2" },
  { id: "l2", fromId: "n2", toId: "n3" },
];

async function removeFixtures() {
  await Meteor.users.removeAsync({ _id: { $in: [USER_ID, OTHER_ORG_USER_ID] } });
  await Organisations.removeAsync({ _id: { $in: [ORG_ID, OTHER_ORG_ID] } });
  await Sites.removeAsync(SITE_ID);
  await FloorMaps.removeAsync(FLOOR_MAP_ID);
  await FloorMapRoutes.removeAsync({ floorMapId: FLOOR_MAP_ID });
  await StorageUnits.removeAsync(STORAGE_UNIT_ID);
  await StorageLocations.removeAsync(STORAGE_LOCATION_ID);
}

async function insertStorageLocation() {
  const now = new Date();
  await StorageLocations.insertAsync({
    _id: STORAGE_LOCATION_ID,
    orgId: ORG_ID,
    storageUnitId: STORAGE_UNIT_ID,
    name: "Top shelf",
    code: "A1",
    lastStocktakeAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertStorageUnit() {
  const now = new Date();
  await StorageUnits.insertAsync({
    _id: STORAGE_UNIT_ID,
    orgId: ORG_ID,
    floorMapId: FLOOR_MAP_ID,
    name: "Route Test Shelf",
    type: "shelf",
    shape: {
      orgId: ORG_ID,
      shapeId: 0,
      name: "Rectangle",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 0, y: 1 },
      ],
      gridReference: { x: 0, y: 0 },
    },
    offset: { x: 1, y: 1 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    createdAt: now,
    updatedAt: now,
  });
}

async function seedFixtures() {
  await removeFixtures();
  const now = new Date();

  for (const [orgId, code] of [
    [ORG_ID, "routeorg"],
    [OTHER_ORG_ID, "routeother"],
  ]) {
    await Organisations.insertAsync({
      _id: orgId,
      name: code,
      code,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const [userId, orgId, username] of [
    [USER_ID, ORG_ID, "routeorg~owner"],
    [OTHER_ORG_USER_ID, OTHER_ORG_ID, "routeother~owner"],
  ]) {
    await Meteor.users.insertAsync({
      _id: userId,
      username,
      profile: { organisationId: orgId, role: OWNER_ROLE, username: "owner" },
    });
  }

  await Sites.insertAsync({
    _id: SITE_ID,
    orgId: ORG_ID,
    name: "Route Test Site",
    createdAt: now,
    updatedAt: now,
  });
  await FloorMaps.insertAsync({
    _id: FLOOR_MAP_ID,
    orgId: ORG_ID,
    siteId: SITE_ID,
    name: "Route Test Floor Map",
    floorSize: { width: 10, height: 8 }, // metres
    createdAt: now,
    updatedAt: now,
  });
}

function callMethod(name, params, userId = USER_ID) {
  const method = Meteor.server.method_handlers[name];
  return Promise.resolve().then(() => method.call({ userId }, params));
}

describeServer("floorMapRoutes.save", function () {
  before(seedFixtures);
  after(removeFixtures);
  afterEach(async function () {
    await FloorMapRoutes.removeAsync({ floorMapId: FLOOR_MAP_ID });
  });

  it("creates the route document on first save", async function () {
    await callMethod("floorMapRoutes.save", {
      floorMapId: FLOOR_MAP_ID,
      nodes: NODES,
      links: LINKS,
    });

    const route = await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_MAP_ID });
    assert.ok(route, "route document should exist");
    assert.strictEqual(route.orgId, ORG_ID);
    assert.deepStrictEqual(route.nodes, NODES);
    assert.deepStrictEqual(route.links, LINKS);
  });

  it("replaces the saved route on later saves, keeping one document per floor map", async function () {
    await callMethod("floorMapRoutes.save", {
      floorMapId: FLOOR_MAP_ID,
      nodes: NODES,
      links: LINKS,
    });
    await callMethod("floorMapRoutes.save", {
      floorMapId: FLOOR_MAP_ID,
      nodes: NODES.slice(0, 2),
      links: LINKS.slice(0, 1),
    });

    const routes = await FloorMapRoutes.find({ floorMapId: FLOOR_MAP_ID }).fetchAsync();
    assert.strictEqual(routes.length, 1);
    assert.strictEqual(routes[0].nodes.length, 2);
    assert.strictEqual(routes[0].links.length, 1);
  });

  it("rejects a duplicate link", async function () {
    await assert.rejects(
      callMethod("floorMapRoutes.save", {
        floorMapId: FLOOR_MAP_ID,
        nodes: NODES,
        links: [...LINKS, { id: "l3", fromId: "n2", toId: "n1" }],
      }),
      (err) => err.error === "invalid-route",
    );
    assert.strictEqual(await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_MAP_ID }), undefined);
  });

  it("rejects a link to a node that does not exist", async function () {
    await assert.rejects(
      callMethod("floorMapRoutes.save", {
        floorMapId: FLOOR_MAP_ID,
        nodes: NODES,
        links: [{ id: "l1", fromId: "n1", toId: "missing" }],
      }),
      (err) => err.error === "invalid-route",
    );
  });

  it("rejects saving to another organisation's floor map", async function () {
    await assert.rejects(
      callMethod(
        "floorMapRoutes.save",
        { floorMapId: FLOOR_MAP_ID, nodes: NODES, links: LINKS },
        OTHER_ORG_USER_ID,
      ),
      (err) => err.error === "forbidden",
    );
  });

  it("is removed when its floor map is deleted", async function () {
    await callMethod("floorMapRoutes.save", {
      floorMapId: FLOOR_MAP_ID,
      nodes: NODES,
      links: LINKS,
    });
    await callMethod("floorMaps.delete", { floorMapId: FLOOR_MAP_ID });

    assert.strictEqual(await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_MAP_ID }), undefined);
    await seedFixtures(); // restore the floor map for any later tests
  });

  describe("product nodes", function () {
    beforeEach(insertStorageUnit);
    afterEach(async function () {
      await StorageUnits.removeAsync(STORAGE_UNIT_ID);
    });

    const PRODUCT_NODE = {
      id: "p1",
      x: 2,
      y: 1,
      type: "product",
      storageUnitId: STORAGE_UNIT_ID,
    };

    it("saves a product node attached to a unit on this floor map", async function () {
      await callMethod("floorMapRoutes.save", {
        floorMapId: FLOOR_MAP_ID,
        nodes: [...NODES, PRODUCT_NODE],
        links: [...LINKS, { id: "l3", fromId: "n1", toId: "p1" }],
      });
      const route = await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_MAP_ID });
      assert.deepStrictEqual(route.nodes.at(-1), PRODUCT_NODE);
    });

    it("rejects a product node on the floor boundary", async function () {
      await assert.rejects(
        callMethod("floorMapRoutes.save", {
          floorMapId: FLOOR_MAP_ID,
          nodes: [{ ...PRODUCT_NODE, x: 0, y: 2 }],
          links: [],
        }),
        (err) => err.error === "invalid-route" && /boundary/.test(err.reason),
      );
    });

    it("rejects a product node attached to a unit that is not on this floor map", async function () {
      await assert.rejects(
        callMethod("floorMapRoutes.save", {
          floorMapId: FLOOR_MAP_ID,
          nodes: [{ ...PRODUCT_NODE, storageUnitId: "some-other-unit" }],
          links: [],
        }),
        (err) => err.error === "invalid-route",
      );
    });

    it("removes the unit's product nodes and their links when the unit is deleted", async function () {
      await callMethod("floorMapRoutes.save", {
        floorMapId: FLOOR_MAP_ID,
        nodes: [...NODES, PRODUCT_NODE],
        links: [...LINKS, { id: "l3", fromId: "n1", toId: "p1" }],
      });
      await callMethod("storageUnits.delete", { storageUnitId: STORAGE_UNIT_ID });

      const route = await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_MAP_ID });
      assert.deepStrictEqual(route.nodes, NODES);
      assert.deepStrictEqual(route.links, LINKS);
    });

    describe("accessible storage locations", function () {
      beforeEach(insertStorageLocation);
      afterEach(async function () {
        await StorageLocations.removeAsync(STORAGE_LOCATION_ID);
      });

      it("saves the storage locations a product node gives access to", async function () {
        await callMethod("floorMapRoutes.save", {
          floorMapId: FLOOR_MAP_ID,
          nodes: [{ ...PRODUCT_NODE, storageLocationIds: [STORAGE_LOCATION_ID] }],
          links: [],
        });
        const route = await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_MAP_ID });
        assert.deepStrictEqual(route.nodes[0].storageLocationIds, [STORAGE_LOCATION_ID]);
      });

      it("rejects a storage location that is not in the node's unit", async function () {
        await assert.rejects(
          callMethod("floorMapRoutes.save", {
            floorMapId: FLOOR_MAP_ID,
            nodes: [{ ...PRODUCT_NODE, storageLocationIds: ["location-elsewhere"] }],
            links: [],
          }),
          (err) => err.error === "invalid-route",
        );
      });

      it("removes a deleted storage location from product nodes", async function () {
        await callMethod("floorMapRoutes.save", {
          floorMapId: FLOOR_MAP_ID,
          nodes: [{ ...PRODUCT_NODE, storageLocationIds: [STORAGE_LOCATION_ID] }],
          links: [],
        });
        await callMethod("storageLocations.delete", { storageLocationId: STORAGE_LOCATION_ID });

        const route = await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_MAP_ID });
        assert.deepStrictEqual(route.nodes[0].storageLocationIds, []);
      });
    });
  });
});
