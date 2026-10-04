import { Meteor } from "meteor/meteor";
import { Products, ProductRecords } from "../products/collections";
import { Sites, FloorMaps, StorageUnits, StorageLocations } from "../locations/collections";
import { ProductCategories } from "../categories/collections";
import { getCallerOrgId, assertOrgAccess, hasPermission } from "../userMethods";

const SEARCH_LIMIT = 15;
const SEARCH_FETCH_LIMIT = 200;
const PENDING_TTL_MS = 5 * 60 * 1000;

// Pages the chatbot may send a user to. Each page is gated by the same route
// permission the app uses, so a role never gets sent somewhere it can't open.
export const NAVIGATION_PAGES = {
  dashboard: { path: () => "/dashboard", permission: "route:/dashboard" },
  inventory: { path: () => "/inventory", permission: "route:/inventory" },
  add_product: { path: () => "/inventory/new", permission: "route:/create-product" },
  product_detail: {
    path: (id) => `/inventory/${id}`,
    permission: "route:/product-detail",
    needsProductId: true,
  },
  edit_product: {
    path: (id) => `/inventory/${id}/edit`,
    permission: "route:/edit-product",
    needsProductId: true,
  },
  floor_map: { path: () => "/floor-map", permission: "route:/floor-map" },
  locations: { path: () => "/locations", permission: "route:/locations" },
  shopping_lists: { path: () => "/lists", permission: "route:/lists" },
  scan: { path: () => "/scan", permission: "route:/scan" },
  qr_codes: { path: () => "/qr-codes", permission: "route:/qr-codes" },
  forecast: { path: () => "/forecast", permission: "route:/forecast" },
  alerts: { path: () => "/alerts", permission: "route:/alerts" },
  accounts: { path: () => "/accounts", permission: "route:/accounts" },
  settings: { path: () => "/settings", permission: "route:/settings" },
};

// Every permission the tool list depends on, so callers can resolve a role once.
export const TOOL_PERMISSIONS = [
  "route:/inventory",
  "products.create",
  "products.update",
  "products.delete",
  ...Object.values(NAVIGATION_PAGES).map((page) => page.permission),
];

// Tools that change data. These go through the confirm-first gate below.
const MUTATING_TOOLS = new Set(["createProduct", "updateProduct", "deleteProduct"]);

const PRODUCT_FIELD_PROPERTIES = {
  name: { type: "string", description: "Product name." },
  description: { type: "string" },
  categoryId: { type: "string", description: "Id from listCategories." },
  sku: { type: "string" },
  brand: { type: "string" },
  unitCost: { type: "number", description: "Sell price." },
  purchaseCost: { type: "number", description: "Purchase price." },
  reorderAt: { type: "integer", description: "Low-stock threshold." },
};

/**
 * Builds the tool list for a caller. `can(permission)` says whether their role
 * holds that permission - tools they can't use are never shown to the model.
 */
export function buildToolDeclarations(can) {
  const tools = [];

  if (can("route:/inventory")) {
    tools.push(
      {
        type: "function",
        name: "searchProducts",
        description:
          "Find products in the user's organisation by name, SKU or brand. Leave query empty to list products, and set lowStockOnly to see only those at or below their reorder threshold.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Optional name, SKU or brand to match." },
            lowStockOnly: { type: "boolean" },
          },
        },
      },
      {
        type: "function",
        name: "getProduct",
        description: "Get one product's details and where its stock is stored.",
        parameters: {
          type: "object",
          properties: { productId: { type: "string" } },
          required: ["productId"],
        },
      },
    );
  }

  if (can("products.create")) {
    tools.push(
      {
        type: "function",
        name: "listLocations",
        description: "List storage locations (id, name, unit, site). Needed to create a product.",
        parameters: { type: "object", properties: {} },
      },
      {
        type: "function",
        name: "listCategories",
        description: "List product categories (id, name).",
        parameters: { type: "object", properties: {} },
      },
      {
        type: "function",
        name: "createProduct",
        description:
          "Create a product with all its starting stock in one storage location. Needs user confirmation first.",
        parameters: {
          type: "object",
          properties: {
            ...PRODUCT_FIELD_PROPERTIES,
            totalQuantity: { type: "integer", description: "Starting stock." },
            locationId: { type: "string", description: "Id from listLocations." },
            confirmed: { type: "boolean" },
          },
          required: ["name", "totalQuantity", "locationId"],
        },
      },
    );
  }

  if (can("products.update")) {
    tools.push({
      type: "function",
      name: "updateProduct",
      description:
        "Change a product's details (not its stock counts). Send only fields to change. Needs user confirmation first.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string" },
          ...PRODUCT_FIELD_PROPERTIES,
          confirmed: { type: "boolean" },
        },
        required: ["productId"],
      },
    });
  }

  if (can("products.delete")) {
    tools.push({
      type: "function",
      name: "deleteProduct",
      description: "Permanently delete a product. Needs user confirmation first.",
      parameters: {
        type: "object",
        properties: { productId: { type: "string" }, confirmed: { type: "boolean" } },
        required: ["productId"],
      },
    });
  }

  const pages = Object.entries(NAVIGATION_PAGES)
    .filter(([, page]) => can(page.permission))
    .map(([name]) => name);
  if (pages.length > 0) {
    tools.push({
      type: "function",
      name: "navigate",
      description: "Take the user to a page of the app.",
      parameters: {
        type: "object",
        properties: {
          page: { type: "string", enum: pages },
          productId: { type: "string", description: "Required for product_detail / edit_product." },
        },
        required: ["page"],
      },
    });
  }

  return tools;
}

// --- confirm-before-write gate ---
// A write only runs if the same call was proposed in an EARLIER chat turn, so
// the user always gets a round trip. In-memory on purpose: if a follow-up lands
// on another server the proposal is simply missing and the bot asks again.
const pendingActions = new Map();

function withoutConfirmed(args) {
  const rest = { ...args };
  delete rest.confirmed;
  return rest;
}

function actionKey(userId, toolName, args) {
  const rest = withoutConfirmed(args);
  const sorted = Object.keys(rest)
    .sort()
    .map((key) => [key, rest[key]]);
  return `${userId}:${toolName}:${JSON.stringify(sorted)}`;
}

function checkConfirmation({ userId, toolName, args, turn }) {
  const key = actionKey(userId, toolName, args);
  const now = Date.now();
  const pending = pendingActions.get(key);

  if (args.confirmed === true && pending && pending.turn < turn && pending.expires > now) {
    pendingActions.delete(key);
    return true;
  }

  pendingActions.set(key, { turn, expires: now + PENDING_TTL_MS });
  return false;
}

export function clearPendingActions() {
  pendingActions.clear();
}

// Runs an existing Meteor method as `userId`, so its own permission and
// organisation checks apply to the chatbot exactly as they do to the UI.
function callMethodAs(userId, name, params) {
  return Meteor.server.method_handlers[name].call({ userId }, params);
}

// --- executors ---
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summariseProduct(product) {
  return {
    id: product._id,
    name: product.name,
    sku: product.sku,
    brand: product.brand,
    totalQuantity: product.totalQuantity,
    reorderAt: product.reorderAt,
    unitCost: product.unitCost,
    purchaseCost: product.purchaseCost,
  };
}

async function searchProducts({ userId, args }) {
  const orgId = await getCallerOrgId(userId);
  const query = String(args.query || "").trim();
  const filter = { orgId };
  if (query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    filter.$or = [{ name: pattern }, { sku: pattern }, { brand: pattern }];
  }

  let products = await Products.find(filter, {
    sort: { name: 1 },
    limit: SEARCH_FETCH_LIMIT,
  }).fetchAsync();
  if (args.lowStockOnly) {
    products = products.filter(
      (product) => product.reorderAt != null && product.totalQuantity <= product.reorderAt,
    );
  }

  return {
    total: products.length,
    products: products.slice(0, SEARCH_LIMIT).map(summariseProduct),
  };
}

async function getProduct({ userId, args }) {
  await assertOrgAccess(Products, args.productId, userId);
  const product = await Products.findOneAsync(args.productId);
  const records = await ProductRecords.find({ productId: args.productId }).fetchAsync();
  return {
    ...summariseProduct(product),
    description: product.description,
    categoryId: product.categoryId,
    assignments: records.map(({ locationId, quantity }) => ({ locationId, quantity })),
  };
}

async function listLocations({ userId }) {
  const orgId = await getCallerOrgId(userId);
  const sites = await Sites.find({ orgId }).fetchAsync();
  const floorMaps = await FloorMaps.find({ siteId: { $in: sites.map((s) => s._id) } }).fetchAsync();
  const units = await StorageUnits.find({
    floorMapId: { $in: floorMaps.map((f) => f._id) },
  }).fetchAsync();
  const locations = await StorageLocations.find({
    storageUnitId: { $in: units.map((u) => u._id) },
  }).fetchAsync();

  return {
    locations: locations.map((location) => {
      const unit = units.find((u) => u._id === location.storageUnitId);
      const floorMap = floorMaps.find((f) => f._id === unit?.floorMapId);
      const site = sites.find((s) => s._id === floorMap?.siteId);
      return { id: location._id, name: location.name, unit: unit?.name, site: site?.name };
    }),
  };
}

async function listCategories({ userId }) {
  const orgId = await getCallerOrgId(userId);
  const categories = await ProductCategories.find({ orgId }).fetchAsync();
  return { categories: categories.map((c) => ({ id: c._id, name: c.name })) };
}

async function createProduct({ userId, args }) {
  const { locationId, ...fields } = withoutConfirmed(args);
  const productId = await callMethodAs(userId, "products.createWithAssignments", {
    ...fields,
    assignments: [{ locationId, quantity: fields.totalQuantity }],
  });
  return { status: "created", productId };
}

async function updateProduct({ userId, args }) {
  const { productId, ...changes } = withoutConfirmed(args);
  await assertOrgAccess(Products, productId, userId);
  const product = await Products.findOneAsync(productId);
  const records = await ProductRecords.find({ productId }).fetchAsync();

  // products.update replaces the whole record, so carry over everything the
  // chat isn't changing (images, stock split, QR code) to avoid wiping it.
  await callMethodAs(userId, "products.update", {
    productId,
    name: changes.name ?? product.name,
    description: changes.description ?? product.description,
    categoryId: changes.categoryId ?? product.categoryId,
    sku: changes.sku ?? product.sku,
    brand: changes.brand ?? product.brand,
    unitCost: changes.unitCost ?? product.unitCost ?? 0,
    purchaseCost: changes.purchaseCost ?? product.purchaseCost ?? 0,
    reorderAt: changes.reorderAt ?? product.reorderAt,
    photoUrl: product.photoUrl || "",
    images: product.images || [],
    catalogImages: product.catalogImages || [],
    qrCode: product.qrCode,
    totalQuantity: product.totalQuantity,
    assignments: records.map(({ locationId, quantity }) => ({ locationId, quantity })),
  });
  return { status: "updated", productId };
}

async function deleteProduct({ userId, args }) {
  await callMethodAs(userId, "products.delete", { productId: args.productId });
  return { status: "deleted", productId: args.productId };
}

async function navigate({ userId, args, actions }) {
  const page = NAVIGATION_PAGES[args.page];
  if (!page || !(await hasPermission(userId, page.permission))) {
    return { error: "You can't open that page with your role." };
  }
  if (page.needsProductId) {
    if (!args.productId) return { error: "productId is required for that page." };
    await assertOrgAccess(Products, args.productId, userId);
  }
  const path = page.path(args.productId);
  actions.push({ type: "navigate", path });
  return { status: "navigating", path };
}

const EXECUTORS = {
  searchProducts,
  getProduct,
  listLocations,
  listCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  navigate,
};

/**
 * Runs one tool call as the calling user. Role checks happen twice: the tool
 * is hidden from the model unless allowed, and the underlying Meteor method /
 * helper re-checks permission and organisation access here.
 */
export async function executeTool({
  userId,
  toolName,
  args = {},
  turn,
  allowedToolNames,
  actions,
}) {
  if (!allowedToolNames.has(toolName) || !EXECUTORS[toolName]) {
    return { error: "That action isn't available for your role." };
  }

  if (MUTATING_TOOLS.has(toolName) && !checkConfirmation({ userId, toolName, args, turn })) {
    return {
      status: "confirmation_required",
      message:
        "Nothing has been changed yet. Tell the user exactly what you are about to do and ask them to confirm. Only after they reply yes, call this tool again with the same arguments and confirmed set to true.",
    };
  }

  try {
    return await EXECUTORS[toolName]({ userId, args, actions });
  } catch (error) {
    return { error: error.reason || error.message || "That action failed." };
  }
}
