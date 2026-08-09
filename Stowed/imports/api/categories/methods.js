import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { ProductCategories } from "./collections";
import { Products } from "../products/collections";
import { getCallerOrgId, assertOrgAccess, requirePermission } from "../userMethods";

Meteor.methods({
  async "productCategories.create"({ name }) {
    check(name, String);
    const orgId = await getCallerOrgId(this.userId);
    await requirePermission(this.userId, "productCategories.manage");

    const existing = await ProductCategories.findOneAsync({
      orgId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) throw new Meteor.Error("duplicate-name", `Category "${name}" already exists.`);

    return await ProductCategories.insertAsync({
      orgId,
      name: name.trim(),
    });
  },

  async "productCategories.rename"({ categoryId, name }) {
    check(categoryId, String);
    check(name, String);
    await assertOrgAccess(ProductCategories, categoryId, this.userId);
    await requirePermission(this.userId, "productCategories.manage");
    await ProductCategories.updateAsync(categoryId, {
      $set: { name: name.trim() },
    });
  },
});