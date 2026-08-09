import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { ShoppingLists } from "./collections";
import { getCallerOrgId, requirePermission } from "../userMethods";
import { SHOPPING_LIST_MODES, LIST_STATUSES } from "./constants";

const itemPattern = {
  productId: String,
  quantityWanted: Match.Integer,
  addMode: String,
  purchased: Boolean,
  received: Boolean,
};

Meteor.methods({
  async "shoppingLists.create"({ mode, frequency, items = [] }) {
    check(mode, String);
    check(frequency, Match.Maybe(String));
    check(items, [itemPattern]);

    if (!this.userId) throw new Meteor.Error("not-authorised", "You must be logged in.");

    const orgId = await getCallerOrgId(this.userId);
    if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

    await requirePermission(this.userId, "shoppingLists.create");

    const now = new Date();

    return await ShoppingLists.insertAsync({
      orgId,
      createdBy: this.userId,
      mode,
      ...(mode === SHOPPING_LIST_MODES.AUTOMATED ? { frequency } : {}),
      status: LIST_STATUSES.SAVED,
      items,
      createdAt: now,
      updatedAt: now,
    });
  },
});