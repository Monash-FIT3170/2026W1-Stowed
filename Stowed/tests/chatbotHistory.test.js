import assert from "assert";
import { Meteor } from "meteor/meteor";
import { ROLES } from "../imports/api/roles";
import { describeServer } from "./serverOnly";

describeServer("Chatbot history", function () {
  const owner = "history-test-owner";
  const colleague = "history-test-colleague";
  const outsider = "history-test-outsider";
  const orgId = "history-test-org";
  let conversations;
  const call = (method, userId, args) =>
    Meteor.server.method_handlers[`chatbot.history.${method}`].call({ userId }, args);
  const snapshot = (conversationId = "history-test-conversation") => ({
    conversationId,
    messages: [
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Help with stocktake" },
      { role: "assistant", content: "Check your locations" },
    ],
    previousInteractionId: "interaction-123",
    pendingAction: null,
  });

  before(async function () {
    ({ ChatConversations: conversations } = await import("../imports/api/chatbot/history"));
    await Meteor.users.removeAsync({ _id: { $in: [owner, colleague, outsider] } });
    for (const id of [owner, colleague, outsider]) {
      await Meteor.users.insertAsync({
        _id: id,
        profile: {
          role: ROLES.STANDARD,
          organisationId: id === outsider ? "history-test-other-org" : orgId,
        },
      });
    }
  });

  beforeEach(async function () {
    await conversations.removeAsync({ userId: { $in: [owner, colleague, outsider] } });
  });

  after(async function () {
    await conversations.removeAsync({ userId: { $in: [owner, colleague, outsider] } });
    await Meteor.users.removeAsync({ _id: { $in: [owner, colleague, outsider] } });
  });

  it("persists and reloads messages and continuation context", async function () {
    const data = snapshot();
    data.pendingAction = { id: "action-123", title: "Create list" };
    data.messages[2].actions = [data.pendingAction];
    await call("save", owner, data);
    const saved = await call("get", owner, data.conversationId);
    assert.deepStrictEqual(saved.messages, data.messages);
    assert.deepStrictEqual(saved.pendingAction, data.pendingAction);
    assert.strictEqual(saved.previousInteractionId, data.previousInteractionId);
    assert.strictEqual(saved.orgId, orgId);
    assert.strictEqual(saved.userId, owner);
    assert.ok(saved.createdAt instanceof Date);
  });

  it("preserves a task awaiting details and clears it when the task ends", async function () {
    const data = snapshot();
    data.activeTask = "createFloorMap";
    await call("save", owner, data);
    const restored = await call("get", owner, data.conversationId);
    assert.strictEqual(restored.activeTask, "createFloorMap");
    assert.strictEqual(restored.pendingAction, null);
    data.activeTask = null;
    await call("save", owner, data);
    assert.strictEqual((await call("get", owner, data.conversationId)).activeTask, null);
  });

  it("updates a resumed chat without creating a duplicate", async function () {
    const data = snapshot();
    await call("save", owner, data);
    const original = await call("get", owner, data.conversationId);
    data.messages.push({ role: "user", content: "Next question" });
    await call("save", owner, data);
    const entries = await call("list", owner);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].title, "Help with stocktake");
    assert.strictEqual(entries[0].messages, undefined);
    const saved = await call("get", owner, data.conversationId);
    assert.strictEqual(saved.messages.length, 4);
    assert.deepStrictEqual(saved.createdAt, original.createdAt);
  });

  it("hides history from other users, including colleagues in the same organisation", async function () {
    const data = snapshot();
    await call("save", owner, data);
    for (const userId of [colleague, outsider]) {
      assert.deepStrictEqual(await call("list", userId), []);
      await assert.rejects(
        call("get", userId, data.conversationId),
        (error) => error.error === "not-found",
      );
      await assert.rejects(call("save", userId, data), (error) => error.error === "not-found");
    }
    assert.strictEqual((await call("get", owner, data.conversationId)).userId, owner);
  });

  it("hides a user's previous organisation history after they move", async function () {
    const data = snapshot();
    await call("save", owner, data);
    await Meteor.users.updateAsync(owner, {
      $set: { "profile.organisationId": "history-test-moved-org" },
    });
    try {
      assert.deepStrictEqual(await call("list", owner), []);
      await assert.rejects(
        call("get", owner, data.conversationId),
        (error) => error.error === "not-found",
      );
      await assert.rejects(call("save", owner, data), (error) => error.error === "not-found");
    } finally {
      await Meteor.users.updateAsync(owner, { $set: { "profile.organisationId": orgId } });
    }
  });

  it("lists newest conversations first and supports older pages", async function () {
    await call("save", owner, snapshot("history-test-first"));
    await call("save", owner, snapshot("history-test-second"));
    await conversations.updateAsync("history-test-first", { $set: { updatedAt: new Date(0) } });
    const entries = await call("list", owner);
    assert.deepStrictEqual(
      entries.map((entry) => entry._id),
      ["history-test-second", "history-test-first"],
    );
    const older = await call("list", owner, { skip: 1 });
    assert.deepStrictEqual(
      older.map((entry) => entry._id),
      ["history-test-first"],
    );
    await assert.rejects(
      call("list", owner, { skip: -1 }),
      (error) => error.error === "invalid-page",
    );
  });

  it("requires authentication for every history method", async function () {
    await assert.rejects(call("list", null), (error) => error.error === "forbidden");
    await assert.rejects(
      call("get", null, "history-test-conversation"),
      (error) => error.error === "forbidden",
    );
    await assert.rejects(call("save", null, snapshot()), (error) => error.error === "forbidden");
  });

  it("rejects empty conversations and oversized snapshots", async function () {
    const data = snapshot();
    data.messages = [{ role: "assistant", content: "Hello" }];
    await assert.rejects(call("save", owner, data), (error) => error.error === "invalid-history");
    data.messages.push({ role: "user", content: "x".repeat(1000001) });
    await assert.rejects(call("save", owner, data), (error) => error.error === "invalid-history");
    assert.deepStrictEqual(await call("list", owner), []);
  });
});
