import { Meteor } from "meteor/meteor";
import { WebApp } from "meteor/webapp";
import crypto from "crypto";
import "/imports/api/products/methods";
import "/imports/api/categories/methods";
import "/imports/api/shoppingLists/methods";
import "/imports/api/schedules/methods";
import "/imports/api/locations/methods";
import "/imports/api/publications";
import "/imports/api/userMethods";
import { ROLES } from "/imports/api/roles";
import "/imports/api/upload.js";
import "/imports/api/bulkImport";
import { Sites, StorageUnits } from "/imports/api/locations/collections";
import { ProductActivities, Products } from "/imports/api/products/collections";
import { seedDatabase, resetDatabase } from "./seed";

// Mark every pre-existing storage unit as already having its QR code generated,
// so units created before the bulk-code feature don't all show as "pending".
async function backfillUnitCodes() {
  await StorageUnits.updateAsync(
    { qrGenerated: { $ne: true } },
    { $set: { qrGenerated: true } },
    { multi: true },
  );
}

Meteor.startup(async () => {
  await Sites.rawCollection().createIndex({ orgId: 1 });
  await Products.rawCollection().createIndex({ orgId: 1 });
  await ProductActivities.rawCollection().createIndex({ orgId: 1, createdAt: -1 });

  await seedDatabase();
  await backfillUnitCodes();
});

// Constant-time string comparison so token checks don't leak via timing.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Protected admin endpoint: POST /admin/reset-seed wipes the DB and reseeds it.
// The route is DISABLED unless a RESET_SEED_TOKEN is configured (Galaxy env var
// or Meteor settings), and requires that token in the `x-reset-token` header.
WebApp.connectHandlers.use("/admin/reset-seed", async (req, res) => {
  const token = process.env.RESET_SEED_TOKEN || Meteor.settings?.RESET_SEED_TOKEN;

  // No token configured -> behave as if the route doesn't exist.
  if (!token) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method Not Allowed");
    return;
  }
  if (!safeEqual(req.headers["x-reset-token"] || "", token)) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  try {
    await resetDatabase();
    await seedDatabase();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "Database reset and reseeded." }));
  } catch (err) {
    console.error("reset-seed failed:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
});

Meteor.publish("allUsers", async function () {
  if (!this.userId) return this.ready();

  const currentUser = await Meteor.users.findOneAsync(this.userId, {
    fields: { "profile.role": 1, "profile.organisationId": 1 },
  });

  if (!currentUser || currentUser.profile.role < ROLES.OWNER) {
    throw new Meteor.Error("unauthorized", "Owners only");
  }

  // Only users from the same organisation
  return Meteor.users.find(
    { "profile.organisationId": currentUser.profile.organisationId },
    {
      fields: {
        username: 1,
        emails: 1,
        "profile.role": 1,
        "profile.username": 1,
      },
    },
  );
});
