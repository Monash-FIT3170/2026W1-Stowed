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
