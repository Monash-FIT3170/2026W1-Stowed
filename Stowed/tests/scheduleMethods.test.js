import assert from "assert";
import { Meteor } from "meteor/meteor";
import { describeServer } from "./serverOnly";
import { Schedules } from "../imports/api/schedules/collections";
import { ShoppingLists } from "../imports/api/shoppingLists/collections";
import { computeNextRunAt } from "../imports/api/schedules/timing";
import {
  SCHEDULE_FREQUENCIES,
  SCHEDULE_FREQUENCY_MS,
  GENERATION_MODES,
} from "../imports/api/schedules/constants";
import { BUDGET_STRATEGIES } from "../imports/api/shoppingLists/constants";
import { Organisations } from "../imports/api/organisations";
import "../imports/api/schedules/methods";

describe("computeNextRunAt", function () {
  const from = new Date("2026-01-01T00:00:00.000Z");

  it("adds 30 seconds for the test cadence", function () {
    assert.strictEqual(
      computeNextRunAt(SCHEDULE_FREQUENCIES.TEST_30S, from).getTime(),
      from.getTime() + 30 * 1000,
    );
  });

  it("adds 7 days for weekly", function () {
    assert.strictEqual(
      computeNextRunAt(SCHEDULE_FREQUENCIES.WEEKLY, from).getTime(),
      from.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
  });

  it("adds 14 days for fortnightly", function () {
    assert.strictEqual(
      computeNextRunAt(SCHEDULE_FREQUENCIES.FORTNIGHTLY, from).getTime(),
      from.getTime() + 14 * 24 * 60 * 60 * 1000,
    );
  });

  it("adds 28 days for monthly", function () {
    assert.strictEqual(
      computeNextRunAt(SCHEDULE_FREQUENCIES.MONTHLY, from).getTime(),
      from.getTime() + 28 * 24 * 60 * 60 * 1000,
    );
  });

  it("falls back to the weekly interval for an unknown frequency", function () {
    assert.strictEqual(
      computeNextRunAt("yearly", from).getTime(),
      from.getTime() + SCHEDULE_FREQUENCY_MS.weekly,
    );
  });

  it("returns a Date without mutating the source", function () {
    const source = new Date(from);
    const next = computeNextRunAt(SCHEDULE_FREQUENCIES.WEEKLY, source);
    assert.ok(next instanceof Date);
    assert.strictEqual(source.getTime(), from.getTime());
  });
});

const TEST_USER_ID = "test-user-id-schedules";
const TEST_ORG_ID = "test-org-id-schedules";
const OTHER_ORG_ID = "test-other-org-schedules";
const OTHER_ORG_USER_ID = "test-other-user-schedules";
const TEST_ROLE = 1; 

function callMethod(name, params) {
  return new Promise((resolve, reject) => {
    const method = Meteor.server.method_handlers[name];
    try {
      Promise.resolve(method.call({ userId: TEST_USER_ID }, params))
        .then(resolve)
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

function makeCreateParams(overrides = {}) {
  return {
    name: "Weekly restock",
    frequency: SCHEDULE_FREQUENCIES.WEEKLY,
    generationMode: GENERATION_MODES.EXPLICIT,
    items: [{ productId: "prod-1", quantityWanted: 3 }],
    autoConfig: undefined,
    siteId: undefined,
    ...overrides,
  };
}

describeServer("schedule methods", function () {
  before(async function () {
    await cleanup();
    const now = new Date();
    await Organisations.insertAsync({
      _id: TEST_ORG_ID,
      name: "Schedules Org",
      code: "schedorg",
      createdAt: now,
      updatedAt: now,
    });
    await Organisations.insertAsync({
      _id: OTHER_ORG_ID,
      name: "Other Schedules Org",
      code: "otherschedorg",
      createdAt: now,
      updatedAt: now,
    });
    await Meteor.users.insertAsync({
      _id: TEST_USER_ID,
      username: "schedorg~tester",
      emails: [{ address: "schedules@test.com", verified: true }],
      profile: { organisationId: TEST_ORG_ID, role: TEST_ROLE, username: "tester" },
    });
    await Meteor.users.insertAsync({
      _id: OTHER_ORG_USER_ID,
      username: "otherschedorg~tester",
      emails: [{ address: "other-schedules@test.com", verified: true }],
      profile: { organisationId: OTHER_ORG_ID, role: TEST_ROLE, username: "other" },
    });
  });

  after(cleanup);

  afterEach(async function () {
    await Schedules.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
    await ShoppingLists.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
  });

  async function cleanup() {
    await Meteor.users.removeAsync(TEST_USER_ID);
    await Meteor.users.removeAsync(OTHER_ORG_USER_ID);
    await Organisations.removeAsync({ _id: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
    await Schedules.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
    await ShoppingLists.removeAsync({ orgId: { $in: [TEST_ORG_ID, OTHER_ORG_ID] } });
  }

  async function seedForeignSchedule() {
    const now = new Date();
    return Schedules.insertAsync({
      orgId: OTHER_ORG_ID,
      createdBy: OTHER_ORG_USER_ID,
      name: "Not yours",
      frequency: SCHEDULE_FREQUENCIES.WEEKLY,
      generationMode: GENERATION_MODES.EXPLICIT,
      items: [],
      isActive: true,
      nextRunAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  describe("schedules.create", function () {
    it("returns a string _id and persists the schedule to the caller's org", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      assert.strictEqual(typeof scheduleId, "string");

      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.orgId, TEST_ORG_ID);
      assert.strictEqual(schedule.createdBy, TEST_USER_ID);
      assert.strictEqual(schedule.name, "Weekly restock");
      assert.strictEqual(schedule.isActive, true);
    });

    it("trims the name and rejects a blank one", async function () {
      const scheduleId = await callMethod(
        "schedules.create",
        makeCreateParams({ name: "  Padded name  " }),
      );
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.name, "Padded name");

      await assert.rejects(
        () => callMethod("schedules.create", makeCreateParams({ name: "   " })),
        /Schedule name cannot be empty/,
      );
    });

    it("computes nextRunAt one interval ahead of creation", async function () {
      const before = Date.now();
      const scheduleId = await callMethod(
        "schedules.create",
        makeCreateParams({ frequency: SCHEDULE_FREQUENCIES.MONTHLY }),
      );
      const after = Date.now();
      const schedule = await Schedules.findOneAsync(scheduleId);
      const nextRunAt = schedule.nextRunAt.getTime();
      assert.ok(nextRunAt >= before + SCHEDULE_FREQUENCY_MS.monthly);
      assert.ok(nextRunAt <= after + SCHEDULE_FREQUENCY_MS.monthly);
    });

    it("stores items for an explicit schedule and no autoConfig", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.deepStrictEqual(schedule.items, [{ productId: "prod-1", quantityWanted: 3 }]);
      assert.strictEqual(schedule.autoConfig, undefined);
    });

    it("stores autoConfig for an auto schedule and no items", async function () {
      const scheduleId = await callMethod(
        "schedules.create",
        makeCreateParams({
          generationMode: GENERATION_MODES.AUTO,
          items: undefined,
          autoConfig: { strategy: BUDGET_STRATEGIES.URGENT, budgetCents: 5000 },
        }),
      );
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.items, undefined);
      assert.deepStrictEqual(schedule.autoConfig, {
        strategy: BUDGET_STRATEGIES.URGENT,
        budgetCents: 5000,
      });
    });

    it("stamps siteId onto the schedule when supplied", async function () {
      const scheduleId = await callMethod(
        "schedules.create",
        makeCreateParams({ siteId: "site-7" }),
      );
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.siteId, "site-7");
    });

    it("rejects a frequency outside the allowed set", async function () {
      await assert.rejects(() =>
        callMethod("schedules.create", makeCreateParams({ frequency: "yearly" })),
      );
    });
  });

  describe("schedules.update", function () {
    it("updates the name and items of an existing schedule", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      await callMethod("schedules.update", {
        scheduleId,
        name: "Renamed schedule",
        items: [{ productId: "prod-2", quantityWanted: 8 }],
      });
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.name, "Renamed schedule");
      assert.deepStrictEqual(schedule.items, [{ productId: "prod-2", quantityWanted: 8 }]);
    });

    it("rejects a blank name on update", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      await assert.rejects(
        () => callMethod("schedules.update", { scheduleId, name: "   " }),
        /Schedule name cannot be empty/,
      );
    });

    it("restarts the countdown from now when the frequency changes", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      const before = Date.now();
      await callMethod("schedules.update", {
        scheduleId,
        frequency: SCHEDULE_FREQUENCIES.FORTNIGHTLY,
      });
      const after = Date.now();
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.frequency, SCHEDULE_FREQUENCIES.FORTNIGHTLY);
      const nextRunAt = schedule.nextRunAt.getTime();
      assert.ok(nextRunAt >= before + SCHEDULE_FREQUENCY_MS.fortnightly);
      assert.ok(nextRunAt <= after + SCHEDULE_FREQUENCY_MS.fortnightly);
    });

    it("refuses to touch a schedule belonging to another org", async function () {
      const foreignId = await seedForeignSchedule();
      await assert.rejects(
        () => callMethod("schedules.update", { scheduleId: foreignId, name: "Hijacked" }),
        /Access denied/,
      );
    });
  });

  describe("schedules.setActive", function () {
    it("pauses a schedule without moving nextRunAt", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      const paused = await Schedules.findOneAsync(scheduleId);
      await callMethod("schedules.setActive", { scheduleId, isActive: false });
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.isActive, false);
      assert.strictEqual(schedule.nextRunAt.getTime(), paused.nextRunAt.getTime());
    });

    it("restarts the countdown from now when resumed", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      await callMethod("schedules.setActive", { scheduleId, isActive: false });
      const before = Date.now();
      await callMethod("schedules.setActive", { scheduleId, isActive: true });
      const after = Date.now();
      const schedule = await Schedules.findOneAsync(scheduleId);
      assert.strictEqual(schedule.isActive, true);
      const nextRunAt = schedule.nextRunAt.getTime();
      assert.ok(nextRunAt >= before + SCHEDULE_FREQUENCY_MS.weekly);
      assert.ok(nextRunAt <= after + SCHEDULE_FREQUENCY_MS.weekly);
    });
  });

  describe("schedules.delete", function () {
    it("removes the schedule", async function () {
      const scheduleId = await callMethod("schedules.create", makeCreateParams());
      await callMethod("schedules.delete", { scheduleId });
      assert.strictEqual(await Schedules.findOneAsync(scheduleId), undefined);
    });

    it("refuses to delete a schedule belonging to another org", async function () {
      const foreignId = await seedForeignSchedule();
      await assert.rejects(
        () => callMethod("schedules.delete", { scheduleId: foreignId }),
        /Access denied/,
      );
      assert.ok(await Schedules.findOneAsync(foreignId));
    });
  });
});
