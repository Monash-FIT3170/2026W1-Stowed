import assert from "assert";
import { Meteor } from "meteor/meteor";
import { Sites, FloorMaps, StorageUnits, MapShapes, StorageLocations } from "../imports/api/locations/collections";
import { Organisations } from "../imports/api/organisations";
import "../imports/api/locations/methods";
 
const TEST_USER_ID = "test-user-id";
const TEST_ORG_ID = "test-org-id";
const TEST_SITE_ID = "test-site-id";
const TEST_FLOOR_MAP_ID = "test-floor-map-id";
const TEST_STORAGE_UNIT_ID = "test-storage-unit-id";
const TEST_LOCATION_ID = "loc-1";
const TEST_ROLE = 3; // ROLES.OWNER - passes all permission checks
 
before(async function () {
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
 
  // Insert location hierarchy: Site -> FloorMap -> StorageUnit -> StorageLocation
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
});
 
after(async function () {
  await Meteor.users.removeAsync(TEST_USER_ID);
  await Organisations.removeAsync(TEST_ORG_ID);
  await Sites.removeAsync(TEST_SITE_ID);
  await FloorMaps.removeAsync(TEST_FLOOR_MAP_ID);
  await StorageUnits.removeAsync(TEST_STORAGE_UNIT_ID);
  await StorageLocations.removeAsync(TEST_LOCATION_ID);
});
 
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
      {x: 1, y: 0},
      {x: 0, y: 1},
      {x: 1, y: 2},
      {x: 2, y: 1},
    ],
    ...overrides,
  };
}
 
// create
describe("mapShapes.create", function () {
  let createdShapeName;
 
  afterEach(async function () {
    if (createdShapeName) {
      await MapShapes.removeAsync({ name: createdShapeName });
      createdShapeName = null;
    }
  });
 
  it("returns a string _id", async function () {
    createdShapeName = await callMethod("mapShapes.create", makeCreateParams());
    assert.strictEqual(typeof createdShapeName, "string");
    assert.ok(createdShapeName.length > 0);
  });
 
  it("persists the product to the database", async function () {
    createdShapeName = await callMethod(
      "mapShapes.create",
      makeCreateParams({ name: "Hexagon", points: [
        {x: 1, y: 0},
        {x: 0, y: 1},
        {x: 1, y: 2},
        {x: 3, y: 2},
        {x: 4, y: 1},
        {x: 3, y: 0}
      ]}),
    );
    
 
    const shape = await MapShapes.findOneAsync(createdShapeName);
    assert.strictEqual(shape.name, "Hexagon");
    assert.strictEqual(shape.points, [{x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 2}, {x: 3, y: 2}, {x: 4, y: 1}, {x: 3, y: 0}]);
  });

  it("calculates bounding box correctly", async function () {
    createdShapeName = await callMethod(
      "mapShapes.create",
      makeCreateParams({ name: "Kite", points: [
        {x: 1, y: 0},
        {x: 0, y: 1},
        {x: 1, y: 3},
        {x: 2, y: 1},
      ] }),
    );

    const shape = await MapShapes.findOneAsync(createdShapeName);
    assert.strictEqual(shape.width, 2);
    assert.strictEqual(shape.height, 3);
  });

  it("defaults to (0, 0) grid reference point", async function () {
    createdShapeName = await callMethod(
      "mapShapes.create",
      makeCreateParams(),
    );

    const shape = await MapShapes.findOneAsync(createdShapeName);
    assert.strictEqual(shape.gridReference.x, 0);
    assert.strictEqual(shape.gridReference.y, 0);
    assert.strictEqual(shape.orgId, TEST_ORG_ID);
  });

  it("retrieves correct organisation ID", async function () {
    createdShapeName = await callMethod(
      "mapShapes.create",
      makeCreateParams(),
    );

    const shape = await MapShapes.findOneAsync(createdShapeName);
    assert.strictEqual(shape.orgId, TEST_ORG_ID);
  });
 
  it("throws duplicate-name when the same name already exists (case-sensitive)", async function () {
    createdShapeName = await callMethod(
      "mapShapes.create",
      makeCreateParams({ name: "Diamond" }),
    );
 
    await assert.rejects(
      () => callMethod("mapShapes.create", makeCreateParams({ name: "Diamond" })),
      (err) => {
        assert.strictEqual(err.error, "duplicate-name");
        return true;
      },
    );
  });
});
 
// delete
describe("mapShapes.delete", function () {
  it("removes the shape from the database", async function () {
    const shapeName = await callMethod(
      "mapShapes.create",
      makeCreateParams(),
    );
 
    await callMethod("products.delete", { productId: shapeName });
 
    const product = await Products.findOneAsync(shapeName);
    assert.strictEqual(product, undefined);
  });
 
  it("throws shape-not-found for an unknown shape name", async function () {
    await assert.rejects(
      () => callMethod("mapShapes.delete", { orgId: TEST_ORG_ID, name: "nonexistent-name" }),
      (err) => {
        assert.strictEqual(err.error, "shape-not-found");
        return true;
      },
    );
  });
});
 
// update
describe("products.update", function () {
  let shapeId;
 
  beforeEach(async function () {
    shapeId = await callMethod(
      "mapShapes.create",
      makeCreateParams({
        name: `Triangle ${Date.now()}`,
        points: [
          {x: 12, y: 0},
          {x: 2, y: 30},
          {x: 0, y: 5}
        ]
      }),
    );
  });
 
  afterEach(async function () {
    if (shapeId) {
      await MapShapes.removeAsync({ name: createdShapeName });
      shapeId = null;
    }
  });
 
  it("updates shape fields in the database", async function () {
    await callMethod("mapShapes.update", {
      ...makeCreateParams({
        points: [
          {x: 0, y: 0},
          {x: 1, y: 1},
          {x: 2, y: 1},
          {x: 3, y: 0}
        ]
      }),
      shapeId: shapeId
    });
 
    const shape = await MapShapes.findOneAsync(shapeId);
    assert.strictEqual(shape.points, [{x: 0, y: 0}, {x: 1, y: 1}, {x: 2, y: 1}, {x: 3, y: 0}]);
    assert.strictEqual(shape.width, 3);
    assert.strictEqual(shape.height, 1);
    assert.strictEqual(shape.gridReference.x, 0);
    assert.strictEqual(shape.gridReference.y, 0);
  });
 
  it("throws duplicate-name when another shape already has the new name", async function () {
    const otherShapeId = await callMethod(
      "mapShapes.create",
      makeCreateParams({ name: "Taken Name" }),
    );
 
    try {
      await assert.rejects(
        () =>
          callMethod("mapShapes.update", {
            ...makeCreateParams({
              name: "Taken Name",
              points: [
                {x: 0, y: 0},
                {x: 1, y: 1},
                {x: 2, y: 1},
                {x: 3, y: 0}
              ]
            }),
            shapeId: shapeId,
          }),
        (err) => {
          assert.strictEqual(err.error, "duplicate-name");
          return true;
        },
      );
    } finally {
      await MapShapes.removeAsync(otherShapeId);
    }
  });
 
  it("allows updating a shape to keep its own name", async function () {
    const shape = await MapShapes.findOneAsync(shapeId);
 
    await callMethod("mapShapes.update", {
      ...makeCreateParams({
        name: shape.name,
        points: [
                {x: 0, y: 0},
                {x: 1, y: 1},
                {x: 2, y: 1},
                {x: 3, y: 0}
              ]
      }),
      shapeId: shapeId,
    });
 
    const updated = await MapShapes.findOneAsync(shapeId);
    assert.strictEqual(updated.name, shape.name);
  });
});