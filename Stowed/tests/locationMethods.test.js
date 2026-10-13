import assert from "assert";
import { Meteor } from "meteor/meteor";
import { describeServer } from "./serverOnly";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  MapShapes,
  StorageLocations,
} from "../imports/api/locations/collections";
import { Organisations } from "../imports/api/organisations";
import "../imports/api/locations/methods";

const TEST_USER_ID = "test-user-id";
const TEST_ORG_ID = "test-org-id";
const TEST_SITE_ID = "test-site-id";
const TEST_FLOOR_MAP_ID = "test-floor-map-id";
const TEST_STORAGE_UNIT_ID = "test-storage-unit-id";
const TEST_LOCATION_ID = "loc-1";
const TEST_ROLE = 3; // ROLES.OWNER - passes all permission checks

async function seedFixtures() {
  // Clean up any leftover test data
  await Meteor.users.removeAsync(TEST_USER_ID);
  await Organisations.removeAsync(TEST_ORG_ID);
  await Sites.removeAsync(TEST_SITE_ID);
  await FloorMaps.removeAsync(TEST_FLOOR_MAP_ID);
  await StorageUnits.removeAsync(TEST_STORAGE_UNIT_ID);
  await StorageLocations.removeAsync(TEST_LOCATION_ID);

  // Insert org
  await Organisations.insertAsync({
    _id: TEST_ORG_ID,
    name: "Test Organisation",
    code: "testorg",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert user linked to org with owner role
  await Meteor.users.insertAsync({
    _id: TEST_USER_ID,
    username: "testorg~testuser",
    emails: [{ address: "test@testorg.com", verified: true }],
    profile: {
      organisationId: TEST_ORG_ID,
      role: TEST_ROLE,
      username: "testuser",
    },
  });

  // Insert location hierarchy: Site -> FloorMap
  await Sites.insertAsync({
    _id: TEST_SITE_ID,
    orgId: TEST_ORG_ID,
    name: "Test Site",
    description: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await FloorMaps.insertAsync({
    _id: TEST_FLOOR_MAP_ID,
    orgId: TEST_ORG_ID,
    siteId: TEST_SITE_ID,
    name: "Test Floor Map",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function clearFixtures() {
  await Meteor.users.removeAsync(TEST_USER_ID);
  await Organisations.removeAsync(TEST_ORG_ID);
  await Sites.removeAsync(TEST_SITE_ID);
  await FloorMaps.removeAsync(TEST_FLOOR_MAP_ID);
  await StorageUnits.removeAsync(TEST_STORAGE_UNIT_ID);
  await StorageLocations.removeAsync(TEST_LOCATION_ID);
}

// These hooks seed and tear down real collections, so they must not run in the
// browser, where they throw "Access denied" before a single test executes.
if (Meteor.isServer) {
  before(seedFixtures);
  after(clearFixtures);
}

function callMethod(name, params) {
  return new Promise((resolve, reject) => {
    const method = Meteor.server.method_handlers[name];
    const context = { userId: TEST_USER_ID };
    try {
      const result = method.call(context, params);
      Promise.resolve(result).then(resolve).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

// So new params dont have to be defined every test
function makeCreateParams(overrides = {}) {
  return {
    name: `Test Shape ${Date.now()}`,
    orgId: TEST_ORG_ID,
    points: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
    ],
    ...overrides,
  };
}

// Order-independent polygon comparison - CCW normalization can
// legitimately reorder/reverse points, so we compare the point sets
// rather than requiring an exact array match.
function assertSamePolygon(actualPoints, expectedPoints) {
  assert.strictEqual(
    actualPoints.length,
    expectedPoints.length,
    `Expected ${expectedPoints.length} points, got ${actualPoints.length}`,
  );
  const remaining = [...actualPoints];
  for (const exp of expectedPoints) {
    const idx = remaining.findIndex((p) => p.x === exp.x && p.y === exp.y);
    assert.ok(idx !== -1, `Expected point (${exp.x}, ${exp.y}) not found in actual points`);
    remaining.splice(idx, 1);
  }
}

// create
describeServer("mapShapes.create", function () {
  let createdShapeId;

  afterEach(async function () {
    if (createdShapeId) {
      await MapShapes.removeAsync(createdShapeId);
      createdShapeId = null;
    }
  });

  it("returns a string _id", async function () {
    createdShapeId = await callMethod("mapShapes.create", makeCreateParams());
    assert.strictEqual(typeof createdShapeId, "string");
    assert.ok(createdShapeId.length > 0);
  });

  it("persists the shape to the database", async function () {
    createdShapeId = await callMethod(
      "mapShapes.create",
      makeCreateParams({
        name: "Hexagon",
        points: [
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 2 },
          { x: 3, y: 2 },
          { x: 4, y: 1 },
          { x: 3, y: 0 },
        ],
      }),
    );

    const shape = await MapShapes.findOneAsync(createdShapeId);
    assert.strictEqual(shape.name, "Hexagon");
    assertSamePolygon(shape.points, [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 1 },
      { x: 3, y: 0 },
    ]);
  });

  it("defaults to (0, 0) grid reference point", async function () {
    createdShapeId = await callMethod("mapShapes.create", makeCreateParams());

    const shape = await MapShapes.findOneAsync(createdShapeId);
    assert.strictEqual(shape.gridReference.x, 0);
    assert.strictEqual(shape.gridReference.y, 0);
    assert.strictEqual(shape.orgId, TEST_ORG_ID);
  });

  it("retrieves correct organisation ID", async function () {
    createdShapeId = await callMethod("mapShapes.create", makeCreateParams());

    const shape = await MapShapes.findOneAsync(createdShapeId);
    assert.strictEqual(shape.orgId, TEST_ORG_ID);
  });

  it("throws duplicate-name when the same name already exists (case-sensitive)", async function () {
    createdShapeId = await callMethod("mapShapes.create", makeCreateParams({ name: "Diamond" }));

    await assert.rejects(
      () => callMethod("mapShapes.create", makeCreateParams({ name: "Diamond" })),
      (err) => {
        assert.strictEqual(err.error, "duplicate-name");
        return true;
      },
    );
  });
});

// update
describeServer("mapShapes.update", function () {
  let shapeId;

  beforeEach(async function () {
    const insertedId = await callMethod(
      "mapShapes.create",
      makeCreateParams({
        name: `Triangle ${Date.now()}`,
        points: [
          { x: 12, y: 0 },
          { x: 2, y: 30 },
          { x: 0, y: 5 },
        ],
      }),
    );
    const created = await MapShapes.findOneAsync(insertedId);
    shapeId = created.shapeId;
  });

  afterEach(async function () {
    if (shapeId !== undefined && shapeId !== null) {
      await MapShapes.removeAsync({ shapeId });
      shapeId = null;
    }
  });

  it("updates shape fields in the database", async function () {
    await callMethod("mapShapes.update", {
      ...makeCreateParams({
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 0 },
        ],
      }),
      shapeId,
    });

    const shape = await MapShapes.findOneAsync({ shapeId });
    assertSamePolygon(shape.points, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 0 },
    ]);
    assert.strictEqual(shape.gridReference.x, 0);
    assert.strictEqual(shape.gridReference.y, 0);
  });

  it("throws duplicate-name when another shape already has the new name", async function () {
    const otherInsertedId = await callMethod(
      "mapShapes.create",
      makeCreateParams({ name: "Taken Name" }),
    );
    const otherShape = await MapShapes.findOneAsync(otherInsertedId);

    try {
      await assert.rejects(
        () =>
          callMethod("mapShapes.update", {
            ...makeCreateParams({
              name: "Taken Name",
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 3, y: 0 },
              ],
            }),
            shapeId,
          }),
        (err) => {
          assert.strictEqual(err.error, "duplicate-name");
          return true;
        },
      );
    } finally {
      await MapShapes.removeAsync({ shapeId: otherShape.shapeId });
    }
  });

  it("allows updating a shape to keep its own name", async function () {
    const shape = await MapShapes.findOneAsync({ shapeId });

    await callMethod("mapShapes.update", {
      ...makeCreateParams({
        name: shape.name,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 0 },
        ],
      }),
      shapeId,
    });

    const updated = await MapShapes.findOneAsync({ shapeId });
    assert.strictEqual(updated.name, shape.name);
  });
});

describeServer("mapShapes.delete", function () {
  const UNIT_ID = "delete-shape-unit";
  let shape;

  beforeEach(async function () {
    await StorageUnits.removeAsync(UNIT_ID);
    const id = await callMethod("mapShapes.create", makeCreateParams({ name: "Deletable Shape" }));
    shape = await MapShapes.findOneAsync(id);
  });

  afterEach(async function () {
    await StorageUnits.removeAsync(UNIT_ID);
    await MapShapes.removeAsync(shape._id);
  });

  it("removes an unused shape", async function () {
    await callMethod("mapShapes.delete", { shape });
    assert.strictEqual(await MapShapes.findOneAsync(shape._id), undefined);
  });

  it("throws shape-is-used when a unit still uses the shape", async function () {
    await StorageUnits.insertAsync({
      _id: UNIT_ID,
      orgId: TEST_ORG_ID,
      floorMapId: TEST_FLOOR_MAP_ID,
      name: "Unit",
      type: "other",
      shape: { ...shape, orgId: TEST_ORG_ID },
      offset: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await assert.rejects(
      () => callMethod("mapShapes.delete", { shape }),
      (err) => err.error === "shape-is-used",
    );
    assert.ok(await MapShapes.findOneAsync(shape._id));
  });
});

describeServer("mapShapes.deleteWithReassign", function () {
  const UNIT_ID = "reassign-shape-unit";
  let oldShape;
  let newShape;

  beforeEach(async function () {
    await StorageUnits.removeAsync(UNIT_ID);
    const oldId = await callMethod("mapShapes.create", makeCreateParams({ name: "Old Shape" }));
    const newId = await callMethod(
      "mapShapes.create",
      makeCreateParams({
        name: "New Shape",
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 0, y: 2 },
        ],
      }),
    );
    oldShape = await MapShapes.findOneAsync(oldId);
    newShape = await MapShapes.findOneAsync(newId);

    await StorageUnits.insertAsync({
      _id: UNIT_ID,
      orgId: TEST_ORG_ID,
      floorMapId: TEST_FLOOR_MAP_ID,
      name: "Unit",
      type: "other",
      shape: { ...oldShape, orgId: TEST_ORG_ID },
      offset: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async function () {
    await StorageUnits.removeAsync(UNIT_ID);
    await MapShapes.removeAsync({ _id: { $in: [oldShape?._id, newShape?._id] } });
  });

  it("switches units to the chosen shape and deletes the old one", async function () {
    await callMethod("mapShapes.deleteWithReassign", {
      shapeId: oldShape.shapeId,
      assignments: [{ storageUnitId: UNIT_ID, targetShapeId: newShape.shapeId }],
    });

    const unit = await StorageUnits.findOneAsync(UNIT_ID);
    assert.strictEqual(unit.shape.shapeId, newShape.shapeId);
    assert.strictEqual(await MapShapes.findOneAsync(oldShape._id), undefined);
  });

  it("rejects when a unit has no replacement", async function () {
    await assert.rejects(
      () =>
        callMethod("mapShapes.deleteWithReassign", { shapeId: oldShape.shapeId, assignments: [] }),
      (err) => err.error === "missing-destination",
    );
    assert.ok(await MapShapes.findOneAsync(oldShape._id));
  });

  it("rejects reassigning to the shape being deleted", async function () {
    await assert.rejects(
      () =>
        callMethod("mapShapes.deleteWithReassign", {
          shapeId: oldShape.shapeId,
          assignments: [{ storageUnitId: UNIT_ID, targetShapeId: oldShape.shapeId }],
        }),
      (err) => err.error === "invalid-destination",
    );
  });

  it("rejects a replacement shape that does not exist", async function () {
    await assert.rejects(
      () =>
        callMethod("mapShapes.deleteWithReassign", {
          shapeId: oldShape.shapeId,
          assignments: [{ storageUnitId: UNIT_ID, targetShapeId: 999999 }],
        }),
      (err) => err.error === "invalid-shape",
    );
    assert.ok(await MapShapes.findOneAsync(oldShape._id));
  });

  it("keeps the unit's position, rotation and scale", async function () {
    await StorageUnits.updateAsync(UNIT_ID, {
      $set: { offset: { x: 3, y: 5 }, rotation: 1.5, scale: { x: 2, y: 3 } },
    });

    await callMethod("mapShapes.deleteWithReassign", {
      shapeId: oldShape.shapeId,
      assignments: [{ storageUnitId: UNIT_ID, targetShapeId: newShape.shapeId }],
    });

    const unit = await StorageUnits.findOneAsync(UNIT_ID);
    assert.deepStrictEqual(unit.offset, { x: 3, y: 5 });
    assert.strictEqual(unit.rotation, 1.5);
    assert.deepStrictEqual(unit.scale, { x: 2, y: 3 });
  });

  it("reassigns several units to different shapes", async function () {
    const secondUnitId = "reassign-shape-unit-2";
    await StorageUnits.insertAsync({
      _id: secondUnitId,
      orgId: TEST_ORG_ID,
      floorMapId: TEST_FLOOR_MAP_ID,
      name: "Unit 2",
      type: "other",
      shape: { ...oldShape, orgId: TEST_ORG_ID },
      offset: { x: 10, y: 10 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const thirdId = await callMethod(
      "mapShapes.create",
      makeCreateParams({
        name: "Third Shape",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      }),
    );
    const thirdShape = await MapShapes.findOneAsync(thirdId);

    try {
      await callMethod("mapShapes.deleteWithReassign", {
        shapeId: oldShape.shapeId,
        assignments: [
          { storageUnitId: UNIT_ID, targetShapeId: newShape.shapeId },
          { storageUnitId: secondUnitId, targetShapeId: thirdShape.shapeId },
        ],
      });

      assert.strictEqual(
        (await StorageUnits.findOneAsync(UNIT_ID)).shape.shapeId,
        newShape.shapeId,
      );
      assert.strictEqual(
        (await StorageUnits.findOneAsync(secondUnitId)).shape.shapeId,
        thirdShape.shapeId,
      );
    } finally {
      await StorageUnits.removeAsync(secondUnitId);
      await MapShapes.removeAsync(thirdShape._id);
    }
  });

  it("leaves units on other shapes untouched", async function () {
    const otherUnitId = "reassign-shape-other-unit";
    await StorageUnits.insertAsync({
      _id: otherUnitId,
      orgId: TEST_ORG_ID,
      floorMapId: TEST_FLOOR_MAP_ID,
      name: "Other",
      type: "other",
      shape: { ...newShape, orgId: TEST_ORG_ID },
      offset: { x: 20, y: 20 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await callMethod("mapShapes.deleteWithReassign", {
        shapeId: oldShape.shapeId,
        assignments: [{ storageUnitId: UNIT_ID, targetShapeId: newShape.shapeId }],
      });

      const other = await StorageUnits.findOneAsync(otherUnitId);
      assert.strictEqual(other.shape.shapeId, newShape.shapeId);
      assert.deepStrictEqual(other.offset, { x: 20, y: 20 });
    } finally {
      await StorageUnits.removeAsync(otherUnitId);
    }
  });
});

// deleteWithReassign
describeServer("storageUnits.deleteWithReassign", function () {
  const SOURCE_UNIT_ID = "reassign-source-unit";
  const TARGET_UNIT_ID = "reassign-target-unit";
  const OTHER_SITE_ID = "reassign-other-site";
  const OTHER_FLOOR_MAP_ID = "reassign-other-floor-map";
  const OTHER_ORG_UNIT_ID = "reassign-other-org-unit";
  const LOCATION_A = "reassign-loc-a";
  const LOCATION_B = "reassign-loc-b";
  const unitIds = [SOURCE_UNIT_ID, TARGET_UNIT_ID, OTHER_ORG_UNIT_ID];
  const locationIds = [LOCATION_A, LOCATION_B];

  function makeUnit(_id, orgId, floorMapId) {
    const now = new Date();
    return {
      _id,
      orgId,
      floorMapId,
      name: _id,
      type: "shelf",
      shape: {
        orgId,
        shapeId: 0,
        name: "reassign-shape",
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
    };
  }

  function makeLocation(_id) {
    const now = new Date();
    return {
      _id,
      orgId: TEST_ORG_ID,
      storageUnitId: SOURCE_UNIT_ID,
      name: _id,
      storedItems: [],
      lastStocktakeAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function cleanup() {
    await StorageUnits.removeAsync({ _id: { $in: unitIds } });
    await StorageLocations.removeAsync({ _id: { $in: locationIds } });
    await FloorMaps.removeAsync(OTHER_FLOOR_MAP_ID);
    await Sites.removeAsync(OTHER_SITE_ID);
  }

  beforeEach(async function () {
    await cleanup();
    const now = new Date();
    await Sites.insertAsync({
      _id: OTHER_SITE_ID,
      orgId: "reassign-other-org",
      name: "Other Site",
      description: "",
      createdAt: now,
      updatedAt: now,
    });
    await FloorMaps.insertAsync({
      _id: OTHER_FLOOR_MAP_ID,
      orgId: "reassign-other-org",
      siteId: OTHER_SITE_ID,
      name: "Other Map",
      createdAt: now,
      updatedAt: now,
    });
    await StorageUnits.insertAsync(makeUnit(SOURCE_UNIT_ID, TEST_ORG_ID, TEST_FLOOR_MAP_ID));
    await StorageUnits.insertAsync(makeUnit(TARGET_UNIT_ID, TEST_ORG_ID, TEST_FLOOR_MAP_ID));
    await StorageUnits.insertAsync(
      makeUnit(OTHER_ORG_UNIT_ID, "reassign-other-org", OTHER_FLOOR_MAP_ID),
    );
    await StorageLocations.insertAsync(makeLocation(LOCATION_A));
    await StorageLocations.insertAsync(makeLocation(LOCATION_B));
  });

  after(cleanup);

  it("moves every location to its chosen unit and deletes the unit", async function () {
    await callMethod("storageUnits.deleteWithReassign", {
      storageUnitId: SOURCE_UNIT_ID,
      assignments: [
        { storageLocationId: LOCATION_A, targetUnitId: TARGET_UNIT_ID },
        { storageLocationId: LOCATION_B, targetUnitId: TARGET_UNIT_ID },
      ],
    });

    assert.strictEqual(await StorageUnits.findOneAsync(SOURCE_UNIT_ID), undefined);
    const locA = await StorageLocations.findOneAsync(LOCATION_A);
    const locB = await StorageLocations.findOneAsync(LOCATION_B);
    assert.strictEqual(locA.storageUnitId, TARGET_UNIT_ID);
    assert.strictEqual(locB.storageUnitId, TARGET_UNIT_ID);
  });

  it("throws missing-destination when a location has no assignment", async function () {
    await assert.rejects(
      () =>
        callMethod("storageUnits.deleteWithReassign", {
          storageUnitId: SOURCE_UNIT_ID,
          assignments: [{ storageLocationId: LOCATION_A, targetUnitId: TARGET_UNIT_ID }],
        }),
      (err) => {
        assert.strictEqual(err.error, "missing-destination");
        return true;
      },
    );
    assert.ok(await StorageUnits.findOneAsync(SOURCE_UNIT_ID));
  });

  it("throws invalid-destination when the target is the unit being deleted", async function () {
    await assert.rejects(
      () =>
        callMethod("storageUnits.deleteWithReassign", {
          storageUnitId: SOURCE_UNIT_ID,
          assignments: [
            { storageLocationId: LOCATION_A, targetUnitId: SOURCE_UNIT_ID },
            { storageLocationId: LOCATION_B, targetUnitId: TARGET_UNIT_ID },
          ],
        }),
      (err) => {
        assert.strictEqual(err.error, "invalid-destination");
        return true;
      },
    );
  });

  it("throws invalid-storage-unit when the target does not exist", async function () {
    await assert.rejects(
      () =>
        callMethod("storageUnits.deleteWithReassign", {
          storageUnitId: SOURCE_UNIT_ID,
          assignments: [
            { storageLocationId: LOCATION_A, targetUnitId: "no-such-unit" },
            { storageLocationId: LOCATION_B, targetUnitId: TARGET_UNIT_ID },
          ],
        }),
      (err) => {
        assert.strictEqual(err.error, "invalid-storage-unit");
        return true;
      },
    );
  });

  it("throws forbidden when the target belongs to another organisation", async function () {
    await assert.rejects(
      () =>
        callMethod("storageUnits.deleteWithReassign", {
          storageUnitId: SOURCE_UNIT_ID,
          assignments: [
            { storageLocationId: LOCATION_A, targetUnitId: OTHER_ORG_UNIT_ID },
            { storageLocationId: LOCATION_B, targetUnitId: TARGET_UNIT_ID },
          ],
        }),
      (err) => {
        assert.strictEqual(err.error, "forbidden");
        return true;
      },
    );
    const locA = await StorageLocations.findOneAsync(LOCATION_A);
    assert.strictEqual(locA.storageUnitId, SOURCE_UNIT_ID);
  });

  it("deletes an empty unit with no assignments", async function () {
    await StorageLocations.removeAsync({ _id: { $in: locationIds } });
    await callMethod("storageUnits.deleteWithReassign", {
      storageUnitId: SOURCE_UNIT_ID,
      assignments: [],
    });
    assert.strictEqual(await StorageUnits.findOneAsync(SOURCE_UNIT_ID), undefined);
  });

  it("throws storage-unit-not-found for an unknown unit", async function () {
    await assert.rejects(
      () =>
        callMethod("storageUnits.deleteWithReassign", {
          storageUnitId: "does-not-exist",
          assignments: [],
        }),
      (err) => err.error === "storage-unit-not-found",
    );
  });

  it("moves nothing when one of several destinations is invalid", async function () {
    await assert.rejects(
      () =>
        callMethod("storageUnits.deleteWithReassign", {
          storageUnitId: SOURCE_UNIT_ID,
          assignments: [
            { storageLocationId: LOCATION_A, targetUnitId: TARGET_UNIT_ID },
            { storageLocationId: LOCATION_B, targetUnitId: "does-not-exist" },
          ],
        }),
      (err) => err.error === "invalid-storage-unit",
    );

    assert.ok(await StorageUnits.findOneAsync(SOURCE_UNIT_ID));
    assert.strictEqual(
      (await StorageLocations.findOneAsync(LOCATION_A)).storageUnitId,
      SOURCE_UNIT_ID,
    );
    assert.strictEqual(
      (await StorageLocations.findOneAsync(LOCATION_B)).storageUnitId,
      SOURCE_UNIT_ID,
    );
  });

  it("sends locations to different destination units", async function () {
    const secondTargetId = "reassign-second-target-unit";
    await StorageUnits.insertAsync(makeUnit(secondTargetId, TEST_ORG_ID, TEST_FLOOR_MAP_ID));

    try {
      await callMethod("storageUnits.deleteWithReassign", {
        storageUnitId: SOURCE_UNIT_ID,
        assignments: [
          { storageLocationId: LOCATION_A, targetUnitId: TARGET_UNIT_ID },
          { storageLocationId: LOCATION_B, targetUnitId: secondTargetId },
        ],
      });

      assert.strictEqual(
        (await StorageLocations.findOneAsync(LOCATION_A)).storageUnitId,
        TARGET_UNIT_ID,
      );
      assert.strictEqual(
        (await StorageLocations.findOneAsync(LOCATION_B)).storageUnitId,
        secondTargetId,
      );
    } finally {
      await StorageUnits.removeAsync(secondTargetId);
    }
  });

  it("keeps the moved location's name and ID", async function () {
    await callMethod("storageUnits.deleteWithReassign", {
      storageUnitId: SOURCE_UNIT_ID,
      assignments: [
        { storageLocationId: LOCATION_A, targetUnitId: TARGET_UNIT_ID },
        { storageLocationId: LOCATION_B, targetUnitId: TARGET_UNIT_ID },
      ],
    });

    const locA = await StorageLocations.findOneAsync(LOCATION_A);
    assert.strictEqual(locA._id, LOCATION_A);
    assert.strictEqual(locA.name, LOCATION_A);
  });
});

describeServer("storageUnits.delete", function () {
  const UNIT_ID = "delete-unit";
  const LOCATION_ID = "delete-unit-loc";

  async function cleanup() {
    await StorageUnits.removeAsync(UNIT_ID);
    await StorageLocations.removeAsync(LOCATION_ID);
  }

  beforeEach(async function () {
    await cleanup();
    const now = new Date();
    await StorageUnits.insertAsync({
      _id: UNIT_ID,
      orgId: TEST_ORG_ID,
      floorMapId: TEST_FLOOR_MAP_ID,
      name: "Delete Me",
      type: "shelf",
      shape: {
        orgId: TEST_ORG_ID,
        shapeId: 0,
        name: "delete-shape",
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
  });

  after(cleanup);

  it("deletes an empty unit", async function () {
    await callMethod("storageUnits.delete", { storageUnitId: UNIT_ID });
    assert.strictEqual(await StorageUnits.findOneAsync(UNIT_ID), undefined);
  });

  it("throws storage-unit-not-empty when the unit has locations", async function () {
    const now = new Date();
    await StorageLocations.insertAsync({
      _id: LOCATION_ID,
      orgId: TEST_ORG_ID,
      storageUnitId: UNIT_ID,
      name: "Loc",
      storedItems: [],
      lastStocktakeAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await assert.rejects(
      () => callMethod("storageUnits.delete", { storageUnitId: UNIT_ID }),
      (err) => err.error === "storage-unit-not-empty",
    );
    assert.ok(await StorageUnits.findOneAsync(UNIT_ID));
  });

  it("throws storage-unit-not-found for an unknown unit", async function () {
    await assert.rejects(
      () => callMethod("storageUnits.delete", { storageUnitId: "does-not-exist" }),
      (err) => err.error === "storage-unit-not-found",
    );
  });
});
