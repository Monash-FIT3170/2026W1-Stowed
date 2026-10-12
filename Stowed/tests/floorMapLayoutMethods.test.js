import assert from "assert";
import { Meteor } from "meteor/meteor";
import { describeServer } from "./serverOnly";
import { ROLES } from "../imports/api/roles";
import { Organisations } from "../imports/api/organisations";
import {
  Sites,
  FloorMaps,
  FloorMapRoutes,
  StorageUnits,
  StorageLocations,
} from "../imports/api/locations/collections";
import { buildRectShape } from "../imports/api/locations/shapeUtils";
import "../imports/api/locations/methods";

// These IDs are reserved for this suite. Cleanup never removes unrelated fixtures.
const ORG_ID = "floor-layout-test-org";
const OTHER_ORG_ID = "floor-layout-test-other-org";
const ADMIN_ID = "floor-layout-test-admin";
const STANDARD_ID = "floor-layout-test-standard";
const OTHER_ADMIN_ID = "floor-layout-test-other-admin";
const SITE_ID = "floor-layout-test-site";
const OTHER_SITE_ID = "floor-layout-test-other-site";
const FLOOR_ID = "floor-layout-test-floor";
const OTHER_FLOOR_ID = "floor-layout-test-other-floor";
const UNIT_ID = "floor-layout-test-unit";
const ORIGINAL_DATE = new Date("2026-01-01T00:00:00.000Z");

function floorInput(overrides = {}) {
  return {
    siteId: SITE_ID,
    name: "Ground floor",
    imageUrl: "",
    floorSize: { width: 500, height: 400 },
    settings: { gridInterval: 1, snapInterval: 0.5, showGrid: true, snapToGrid: true },
    ...overrides,
  };
}

function unitInput(overrides = {}) {
  return {
    floorMapId: FLOOR_ID,
    name: "Shelf A",
    type: "shelf",
    shape: buildRectShape({ width: 2, height: 1 }),
    offset: { x: 1, y: 1 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    fill: "#7a5230",
    ...overrides,
  };
}

function callMethod(name, params, userId = ADMIN_ID) {
  const handler = Meteor.server.method_handlers[name];
  assert.strictEqual(typeof handler, "function", `${name} should be registered`);
  return Promise.resolve().then(() => handler.call({ userId }, params));
}

async function cleanup() {
  const orgs = { orgId: { $in: [ORG_ID, OTHER_ORG_ID] } };
  await StorageLocations.removeAsync(orgs);
  await StorageUnits.removeAsync(orgs);
  await FloorMapRoutes.removeAsync(orgs);
  await FloorMaps.removeAsync(orgs);
  await Sites.removeAsync(orgs);
  await Meteor.users.removeAsync({ _id: { $in: [ADMIN_ID, STANDARD_ID, OTHER_ADMIN_ID] } });
  await Organisations.removeAsync({ _id: { $in: [ORG_ID, OTHER_ORG_ID] } });
}

async function seed() {
  await cleanup();
  for (const [orgId, siteId, floorId, code] of [
    [ORG_ID, SITE_ID, FLOOR_ID, "floorlayouttest"],
    [OTHER_ORG_ID, OTHER_SITE_ID, OTHER_FLOOR_ID, "floorlayoutother"],
  ]) {
    await Organisations.insertAsync({
      _id: orgId,
      name: code,
      code,
      createdAt: ORIGINAL_DATE,
      updatedAt: ORIGINAL_DATE,
    });
    await Sites.insertAsync({
      _id: siteId,
      orgId,
      name: code,
      createdAt: ORIGINAL_DATE,
      updatedAt: ORIGINAL_DATE,
    });
    await FloorMaps.insertAsync({
      _id: floorId,
      orgId,
      ...floorInput({ siteId }),
      createdAt: ORIGINAL_DATE,
      updatedAt: ORIGINAL_DATE,
    });
  }
  for (const [userId, orgId, role] of [
    [ADMIN_ID, ORG_ID, ROLES.ADMIN],
    [STANDARD_ID, ORG_ID, ROLES.STANDARD],
    [OTHER_ADMIN_ID, OTHER_ORG_ID, ROLES.ADMIN],
  ]) {
    await Meteor.users.insertAsync({
      _id: userId,
      username: userId,
      profile: { organisationId: orgId, role },
    });
  }
  const input = unitInput();
  await StorageUnits.insertAsync({
    _id: UNIT_ID,
    orgId: ORG_ID,
    ...input,
    shape: { ...input.shape, orgId: ORG_ID },
    createdAt: ORIGINAL_DATE,
    updatedAt: ORIGINAL_DATE,
  });
}

async function snapshot() {
  const query = { orgId: { $in: [ORG_ID, OTHER_ORG_ID] } };
  const options = { sort: { _id: 1 } };
  return {
    floors: await FloorMaps.find(query, options).fetchAsync(),
    units: await StorageUnits.find(query, options).fetchAsync(),
    routes: await FloorMapRoutes.find(query, options).fetchAsync(),
    locations: await StorageLocations.find(query, options).fetchAsync(),
  };
}

async function rejectsWithoutChanges(name, params, errorCode, userId = ADMIN_ID) {
  const before = await snapshot();
  await assert.rejects(callMethod(name, params, userId), (error) => error.error === errorCode);
  assert.deepStrictEqual(await snapshot(), before, "Rejected writes must not change the layout");
}

describeServer("Layout persistence and permissions", function () {
  this.timeout(10000);
  beforeEach(seed);
  afterEach(cleanup);

  it("creates a floor with its size, editor settings and organisation", async function () {
    const input = floorInput({ name: "First floor" });
    const id = await callMethod("floorMaps.create", input);
    assert.strictEqual(typeof id, "string");
    const saved = await FloorMaps.findOneAsync(id);
    assert.strictEqual(saved.orgId, ORG_ID);
    assert.strictEqual(saved.siteId, SITE_ID);
    assert.strictEqual(saved.name, input.name);
    assert.deepStrictEqual(saved.floorSize, input.floorSize);
    assert.deepStrictEqual(saved.settings, input.settings);
    assert.ok(saved.createdAt instanceof Date);
  });

  it("updates floor settings without changing its units or creation date", async function () {
    const unitBefore = await StorageUnits.findOneAsync(UNIT_ID);
    const input = floorInput({
      floorMapId: FLOOR_ID,
      name: "Renamed floor",
      floorSize: { width: 800, height: 600 },
      settings: { gridInterval: 2, snapInterval: 0.25, showGrid: false, snapToGrid: false },
    });
    await callMethod("floorMaps.update", input);
    const saved = await FloorMaps.findOneAsync(FLOOR_ID);
    assert.strictEqual(saved.name, "Renamed floor");
    assert.deepStrictEqual(saved.floorSize, input.floorSize);
    assert.deepStrictEqual(saved.settings, input.settings);
    assert.deepStrictEqual(saved.createdAt, ORIGINAL_DATE);
    assert.ok(saved.updatedAt > ORIGINAL_DATE);
    assert.deepStrictEqual(await StorageUnits.findOneAsync(UNIT_ID), unitBefore);
  });

  it("rejects an invalid floor size without overwriting the saved floor", async function () {
    const before = await snapshot();
    await assert.rejects(
      callMethod(
        "floorMaps.update",
        floorInput({
          floorMapId: FLOOR_ID,
          floorSize: { width: -1, height: 400 },
        }),
      ),
    );
    assert.deepStrictEqual(await snapshot(), before);
  });

  it("creates a unit with custom geometry and server-owned organisation metadata", async function () {
    const input = unitInput({
      name: "Triangle shelf",
      type: "custom",
      shape: {
        ...buildRectShape({ width: 2, height: 1 }),
        orgId: OTHER_ORG_ID,
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: 1 },
        ],
      },
      offset: { x: 4, y: 3 },
      rotation: Math.PI / 2,
      scale: { x: 2, y: 3 },
      fill: "#123456",
    });
    const id = await callMethod("storageUnits.create", input);
    const saved = await StorageUnits.findOneAsync(id);
    assert.strictEqual(saved.orgId, ORG_ID);
    assert.strictEqual(saved.shape.orgId, ORG_ID);
    for (const key of ["name", "type", "floorMapId", "offset", "rotation", "scale", "fill"]) {
      assert.deepStrictEqual(saved[key], input[key]);
    }
    assert.deepStrictEqual(saved.shape.points, input.shape.points);
  });

  it("keeps saved moves, renames and geometry when another unit is added and deleted", async function () {
    // This checks database persistence. It does not exercise unsaved React editor state.
    const input = unitInput({
      storageUnitId: UNIT_ID,
      name: "Moved and renamed",
      offset: { x: 4, y: 3 },
      shape: buildRectShape({ width: 3, height: 2 }),
      rotation: Math.PI / 4,
      scale: { x: 1.5, y: 0.5 },
      fill: "#abcdef",
    });
    await callMethod("storageUnits.update", input);
    const updated = await StorageUnits.findOneAsync(UNIT_ID);
    for (const key of ["name", "offset", "rotation", "scale", "fill"]) {
      assert.deepStrictEqual(updated[key], input[key]);
    }
    assert.deepStrictEqual(updated.shape.points, input.shape.points);
    assert.deepStrictEqual(updated.createdAt, ORIGINAL_DATE);
    const newId = await callMethod("storageUnits.create", unitInput({ name: "Temporary shelf" }));
    assert.deepStrictEqual(await StorageUnits.findOneAsync(UNIT_ID), updated);
    await callMethod("storageUnits.delete", { storageUnitId: newId });
    assert.strictEqual(await StorageUnits.findOneAsync(newId), undefined);
    assert.deepStrictEqual(await StorageUnits.findOneAsync(UNIT_ID), updated);
  });

  it("prevents deleting a floor while it still contains a unit", async function () {
    await rejectsWithoutChanges(
      "floorMaps.delete",
      { floorMapId: FLOOR_ID },
      "floor-map-not-empty",
    );
  });

  it("deletes an empty floor and its route while preserving another organisation's floor", async function () {
    await callMethod("storageUnits.delete", { storageUnitId: UNIT_ID });
    await callMethod("floorMapRoutes.save", {
      floorMapId: FLOOR_ID,
      nodes: [{ id: "walkway", x: 1, y: 1 }],
      links: [],
    });
    await callMethod("floorMaps.delete", { floorMapId: FLOOR_ID });
    assert.strictEqual(await FloorMaps.findOneAsync(FLOOR_ID), undefined);
    assert.strictEqual(await FloorMapRoutes.findOneAsync({ floorMapId: FLOOR_ID }), undefined);
    assert.ok(await FloorMaps.findOneAsync(OTHER_FLOOR_ID));
  });

  it("prevents deleting a unit while it contains a storage location", async function () {
    await StorageLocations.insertAsync({
      _id: "floor-layout-test-location",
      orgId: ORG_ID,
      storageUnitId: UNIT_ID,
      name: "Top shelf",
      code: "A1",
      lastStocktakeAt: ORIGINAL_DATE,
      createdAt: ORIGINAL_DATE,
      updatedAt: ORIGINAL_DATE,
    });
    await rejectsWithoutChanges(
      "storageUnits.delete",
      { storageUnitId: UNIT_ID },
      "storage-unit-not-empty",
    );
  });

  it("prevents moving a floor into another organisation's site", async function () {
    await rejectsWithoutChanges(
      "floorMaps.update",
      floorInput({ floorMapId: FLOOR_ID, siteId: OTHER_SITE_ID }),
      "forbidden",
    );
  });

  it("prevents moving a unit into another organisation's floor", async function () {
    await rejectsWithoutChanges(
      "storageUnits.update",
      unitInput({ storageUnitId: UNIT_ID, floorMapId: OTHER_FLOOR_ID }),
      "forbidden",
    );
  });

  for (const [method, params, errorCode] of [
    [
      "floorMaps.update",
      floorInput({ floorMapId: "floor-layout-test-missing" }),
      "floor-map-not-found",
    ],
    ["floorMaps.delete", { floorMapId: "floor-layout-test-missing" }, "floor-map-not-found"],
    [
      "storageUnits.create",
      unitInput({ floorMapId: "floor-layout-test-missing" }),
      "invalid-floor-map",
    ],
    [
      "storageUnits.update",
      unitInput({ storageUnitId: UNIT_ID, floorMapId: "floor-layout-test-missing" }),
      "invalid-floor-map",
    ],
    [
      "storageUnits.update",
      unitInput({ storageUnitId: "floor-layout-test-missing" }),
      "storage-unit-not-found",
    ],
    [
      "storageUnits.delete",
      { storageUnitId: "floor-layout-test-missing" },
      "storage-unit-not-found",
    ],
  ]) {
    it(`${method} rejects missing records (${errorCode})`, async function () {
      await rejectsWithoutChanges(method, params, errorCode);
    });
  }

  for (const [label, userId, errorCode] of [
    ["a signed-out user", null, "not-authorised"],
    ["a standard employee", STANDARD_ID, "forbidden"],
    ["an administrator from another organisation", OTHER_ADMIN_ID, "forbidden"],
  ]) {
    describe(`rejects writes by ${label}`, function () {
      for (const [method, params] of [
        ["floorMaps.create", floorInput()],
        ["floorMaps.update", floorInput({ floorMapId: FLOOR_ID })],
        ["floorMaps.delete", { floorMapId: FLOOR_ID }],
        ["storageUnits.create", unitInput()],
        ["storageUnits.update", unitInput({ storageUnitId: UNIT_ID })],
        ["storageUnits.delete", { storageUnitId: UNIT_ID }],
        ["floorMapRoutes.save", { floorMapId: FLOOR_ID, nodes: [], links: [] }],
      ]) {
        it(method, async function () {
          await rejectsWithoutChanges(method, params, errorCode, userId);
        });
      }
    });
  }
});
