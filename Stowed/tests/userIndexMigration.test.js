import assert from "assert";
import { removeLegacyUserEmailIndex } from "../server/userIndexMigration";

describe("Legacy user email index migration", function () {
  it("removes only the obsolete unique top-level email index", async function () {
    const dropped = [];
    const rawUsersCollection = {
      indexes: async () => [
        { name: "email_1", key: { email: 1 }, unique: true },
        { name: "emails.address_1", key: { "emails.address": 1 }, unique: true },
        { name: "username_1", key: { username: 1 }, unique: true },
      ],
      dropIndex: async (name) => dropped.push(name),
    };

    assert.strictEqual(await removeLegacyUserEmailIndex(rawUsersCollection), true);
    assert.deepStrictEqual(dropped, ["email_1"]);
  });

  it("leaves unrelated and already migrated indexes alone", async function () {
    const dropped = [];
    const rawUsersCollection = {
      indexes: async () => [
        { name: "email_1", key: { email: 1 }, unique: false },
        { name: "emails.address_1", key: { "emails.address": 1 }, unique: true },
      ],
      dropIndex: async (name) => dropped.push(name),
    };

    assert.strictEqual(await removeLegacyUserEmailIndex(rawUsersCollection), false);
    assert.deepStrictEqual(dropped, []);
  });

  it("allows a fresh database with no users collection", async function () {
    const rawUsersCollection = {
      indexes: async () => {
        const error = new Error("namespace does not exist");
        error.code = 26;
        throw error;
      },
      dropIndex: async () => assert.fail("No index should be dropped"),
    };

    assert.strictEqual(await removeLegacyUserEmailIndex(rawUsersCollection), false);
  });
});
