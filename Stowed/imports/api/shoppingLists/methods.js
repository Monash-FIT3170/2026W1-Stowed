import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { ShoppingLists } from "./collections";
import { getCallerOrgId, assertOrgAccess, requirePermission } from "../userMethods";
import { LIST_STATUSES } from "./constants";

const itemPattern = {
  productId: String,
  productName: String,
  sku: Match.Maybe(String),
  categoryId: Match.Maybe(String),
  inStock: Match.Integer,
  reorderAt: Match.Integer,
  lowStockThreshold: Match.Integer,
  unitCost: Number,
  quantityWanted: Match.Integer,
  addMode: String,
  purchased: Boolean,
  received: Boolean,
  allocatedLocationId: Match.Maybe(String),
  allocatedLocationName: Match.Maybe(String),
  allocatedAt: Match.Maybe(Date),
};

Meteor.methods({
  async "shoppingLists.create"({ name, origin, scheduleId, scheduleName, items = [] }) {
    check(name, String);
    check(origin, String);
    check(scheduleId, Match.Maybe(String));
    check(scheduleName, Match.Maybe(String));
    check(items, [itemPattern]);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Meteor.Error("invalid-name", "List name cannot be empty.");

    const orgId = await getCallerOrgId(this.userId);

    await requirePermission(this.userId, "shoppingLists.create");

    const now = new Date();

    return await ShoppingLists.insertAsync({
      orgId,
      createdBy: this.userId,
      name: trimmedName,
      origin,
      ...(scheduleId !== undefined ? { scheduleId } : {}),
      ...(scheduleName !== undefined ? { scheduleName } : {}),
      items,
      createdAt: now,
      updatedAt: now,
    });
  },

  async "shoppingLists.rename"({ listId, name }) {
    check(listId, String);
    check(name, String);

    const trimmedName = name.trim();
    if (!trimmedName) throw new Meteor.Error("invalid-name", "List name cannot be empty.");

    await assertOrgAccess(ShoppingLists, listId, this.userId);
    await requirePermission(this.userId, "shoppingLists.rename");

    await ShoppingLists.updateAsync(listId, {
      $set: { name: trimmedName, updatedAt: new Date() },
    });
  },

  async "shoppingLists.update"({
    listId,
    items,
    siteId,
    status,
    archivedAt,
    archivedWithPendingItems,
  }) {
    check(listId, String);
    check(items, Match.Maybe([itemPattern]));
    check(siteId, Match.Maybe(String));
    check(status, Match.Maybe(String));
    check(archivedAt, Match.Maybe(Date));
    check(archivedWithPendingItems, Match.Maybe(Boolean));

    if (status !== undefined && !Object.values(LIST_STATUSES).includes(status)) {
      throw new Meteor.Error("invalid-status", "Unknown list status.");
    }

    await assertOrgAccess(ShoppingLists, listId, this.userId);
    await requirePermission(this.userId, "shoppingLists.update");

    const set = { updatedAt: new Date() };
    if (items !== undefined) set.items = items;
    if (siteId !== undefined) set.siteId = siteId;
    if (status !== undefined) set.status = status;
    if (archivedAt !== undefined) set.archivedAt = archivedAt;
    if (archivedWithPendingItems !== undefined)
      set.archivedWithPendingItems = archivedWithPendingItems;

    await ShoppingLists.updateAsync(listId, { $set: set });
  },

  async "shoppingLists.delete"({ listId }) {
    check(listId, String);

    await assertOrgAccess(ShoppingLists, listId, this.userId);
    await requirePermission(this.userId, "shoppingLists.delete");

    await ShoppingLists.removeAsync(listId);
  },
});
