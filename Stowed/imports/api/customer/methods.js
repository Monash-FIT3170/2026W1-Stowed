import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { DDPRateLimiter } from "meteor/ddp-rate-limiter";
import { findOrgIdByCode } from "../organisations";
import { Products, ProductRecords } from "../products/collections";
import { ProductCategories } from "../categories/collections";
import { StorageUnits, StorageLocations } from "../locations/collections";
import { buildLocationsByProductId, toCustomerProduct } from "./catalogue";

/**
 * Customer catalogue methods
 *
 * A customer browses without an account, so these are callable anonymously and
 * are scoped by the org code the visitor entered through, not by a user. Every
 * product leaves through toCustomerProduct, which whitelists the fields a
 * shopper may see.
 *
 * Methods rather than a publication: the customer view joins products,
 * categories, stock records, locations and units, and a shopper does not need
 * it to update live - the page fetches on arrival.
 */

async function requireOrgId(orgCode) {
  const orgId = await findOrgIdByCode(orgCode);
  if (!orgId) throw new Meteor.Error("not-found", "Organisation not found.");
  return orgId;
}

async function loadCustomerProducts(orgId, productSelector = {}) {
  const products = await Products.find({ ...productSelector, orgId }).fetchAsync();
  if (products.length === 0) return [];

  const productIds = products.map((p) => p._id);
  const [categories, productRecords, storageLocations, storageUnits] = await Promise.all([
    ProductCategories.find({ orgId }, { fields: { name: 1 } }).fetchAsync(),
    ProductRecords.find(
      { productId: { $in: productIds } },
      { fields: { productId: 1, locationId: 1, quantity: 1 } },
    ).fetchAsync(),
    StorageLocations.find({ orgId }, { fields: { name: 1, storageUnitId: 1 } }).fetchAsync(),
    StorageUnits.find({ orgId }, { fields: { name: 1 } }).fetchAsync(),
  ]);

  const categoryNameById = new Map(categories.map((cat) => [cat._id, cat.name]));
  const locationsByProductId = buildLocationsByProductId(
    productRecords,
    storageLocations,
    storageUnits,
  );

  return products.map((product) =>
    toCustomerProduct(product, { categoryNameById, locationsByProductId }),
  );
}

Meteor.methods({
  "customer.products.list": async function ({ orgCode }) {
    const orgId = await requireOrgId(orgCode);
    return loadCustomerProducts(orgId);
  },

  // Scoped to the org as well as the id, so a product id from another store
  // reads as not found rather than leaking across organisations.
  "customer.products.get": async function ({ orgCode, productId }) {
    check(productId, String);
    const orgId = await requireOrgId(orgCode);
    const [product] = await loadCustomerProducts(orgId, { _id: productId });
    if (!product) throw new Meteor.Error("not-found", "Product not found.");
    return product;
  },
});

// Anonymous callers: cap how fast one connection can page through catalogues.
DDPRateLimiter.addRule(
  { type: "method", name: (name) => name.startsWith("customer.products.") },
  30,
  10000,
);
