import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { getCallerOrgId, hasPermission, requirePermission } from "../userMethods";
import { buildToolDeclarations, executeTool, TOOL_PERMISSIONS } from "./tools";
import { FloorMaps, Sites, StorageLocations, StorageUnits } from "../locations/collections";
import { buildRectShape, getBoundingBox } from "../locations/shapeUtils";
import { Products, ProductRecords } from "../products/collections";
import { ShoppingLists } from "../shoppingLists/collections";
import { ADD_PRODUCT_MODES, LIST_FREQUENCIES, LIST_ORIGINS } from "../shoppingLists/constants";
import { isLowStock, toItem } from "../shoppingLists/generation";

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_TOOL_ROUNDS = 5;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_MAX_OUTPUT_TOKENS = 256;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_ERROR_MESSAGE = "Sorry, we cannot help with that right now.";
const ACTION_TYPES = {
  CREATE_SHOPPING_LIST: "createShoppingList",
  CREATE_LOW_STOCK_LIST: "createLowStockShoppingList",
  CREATE_FLOOR_MAP: "createFloorMap",
  CREATE_STORAGE_UNIT: "createStorageUnit",
  MOVE_STORAGE_UNIT: "moveStorageUnit",
  RESIZE_STORAGE_UNIT: "resizeStorageUnit",
  ASSIGN_STOCK_TO_UNIT: "assignStockToUnit",
  OPEN_STORAGE_UNIT: "openStorageUnit",
  SHOW_LOW_STOCK_FLOOR_MAP: "showLowStockFloorMap",
  SHOW_FLOOR_MAP_EDITOR: "showFloorMapEditor",
};
const actionPattern = {
  id: String,
  type: Match.Where((value) => Object.values(ACTION_TYPES).includes(value)),
  title: String,
  summary: String,
  confirmLabel: String,
  payload: Object,
};
const SYSTEM_INSTRUCTION = [
  "You are the assistant inside Stowed, an inventory app for shops and storerooms.",
  "Help with inventory, stocktakes, locations, shopping lists, QR codes, storage units, and related workflows.",
  "If the user asks for something outside Stowed's inventory scope, briefly say you can only help with Stowed inventory tasks.",
  "Use the tools to look things up and to act for the user; never invent product or location ids.",
  "You can only use the tools you are given - they match the user's role. If asked for something outside them, say you can't do that with their account.",
  "To create, edit or delete a product: first call the tool WITHOUT confirmed (this only previews, nothing changes), then tell the user exactly what will change and end your message with: Reply CONFIRM to proceed.",
  "If the user's next message is CONFIRM (any capitalisation, or a plain yes), immediately call the same tool again with exactly the same arguments plus confirmed true - do not ask again. Any other reply cancels the change.",
  "When asked to take the user somewhere, use the navigate tool. Keep replies short.",
].join(" ");

let aiClient = null;
let chatTurn = 0;
let localSettings = null;

function getLocalSettings() {
  if (localSettings) return localSettings;

  const projectRoot = process.cwd().split(path.sep + ".meteor")[0];
  const settingsPath = path.join(projectRoot, "settings.json");

  try {
    localSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    localSettings = {};
  }

  return localSettings;
}

function getSetting(name) {
  const fileSettings = getLocalSettings();

  return (
    process.env[name] ||
    Meteor.settings?.[name] ||
    Meteor.settings?.private?.[name] ||
    fileSettings?.[name] ||
    fileSettings?.private?.[name]
  );
}

function getNumberSetting(name, fallback) {
  const value = Number(getSetting(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getAiClient() {
  const apiKey = getSetting("GEMINI_API_KEY") || getSetting("GOOGLE_API_KEY");
  if (!apiKey) {
    throw new Meteor.Error(
      "gemini-not-configured",
      "Gemini API key is not configured. Start Meteor with --settings settings.json or set GEMINI_API_KEY.",
    );
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
}

function getChatbotConfigStatus() {
  const apiKey = getSetting("GEMINI_API_KEY") || getSetting("GOOGLE_API_KEY");
  const model = getSetting("GEMINI_MODEL") || DEFAULT_MODEL;

  return {
    hasApiKey: Boolean(apiKey),
    keySource: process.env.GEMINI_API_KEY
      ? "environment"
      : process.env.GOOGLE_API_KEY
        ? "environment"
        : Meteor.settings?.GEMINI_API_KEY || Meteor.settings?.private?.GEMINI_API_KEY
          ? "settings"
          : Meteor.settings?.GOOGLE_API_KEY || Meteor.settings?.private?.GOOGLE_API_KEY
            ? "settings"
            : getLocalSettings()?.GEMINI_API_KEY || getLocalSettings()?.private?.GEMINI_API_KEY
              ? "settings.json"
              : getLocalSettings()?.GOOGLE_API_KEY || getLocalSettings()?.private?.GOOGLE_API_KEY
                ? "settings.json"
                : "missing",
    model,
  };
}

function getLatestUserInput(messages) {
  const latestUserMessage = messages
    .slice(-MAX_MESSAGES)
    .reverse()
    .find((message) => message.role === "user" && message.content.trim().length > 0);

  return latestUserMessage?.content.trim().slice(0, MAX_MESSAGE_LENGTH) || "";
}

function makeActionId(type) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanExtractedName(value) {
  return value
    .replace(/[?.!]+$/, "")
    .replace(/\b(?:weekly|fortnightly|monthly)\s*$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
}

export function extractName(input, fallback) {
  const quoted = input.match(/["']([^"']{2,80})["']/);
  if (quoted) return quoted[1].trim();

  const named = input.match(
    /\b(?:named|called|title(?:d)?|name it|with (?:the )?name)\s+(.{2,80}?)(?=\s+(?:using|for|from|on|in|at)\b|[?.!]*$)/i,
  );
  if (named) return cleanExtractedName(named[1]);

  return fallback;
}

function extractPendingActionName(input, fallback) {
  const change = input.match(
    /^\s*(?:change|rename|call|name|title)\b.*?\b(?:to|as)\s+(.{2,80})[?.!]*$/i,
  );
  if (change) return cleanExtractedName(change[1]);

  const directName = input.match(
    /^\s*(?:rename|call|name|title)\s+(?:it|this|the list)\s+(.{2,80})[?.!]*$/i,
  );
  if (directName) return cleanExtractedName(directName[1]);

  return fallback;
}

function frequencyFrom(input, fallback = LIST_FREQUENCIES.WEEKLY) {
  if (/\bmonthly\b/i.test(input)) return LIST_FREQUENCIES.MONTHLY;
  if (/\bfortnightly|every two weeks\b/i.test(input)) return LIST_FREQUENCIES.FORTNIGHTLY;
  if (/\bweekly\b/i.test(input)) return LIST_FREQUENCIES.WEEKLY;
  return fallback;
}

function describeAction(action) {
  if (action.type === ACTION_TYPES.CREATE_LOW_STOCK_LIST) {
    return `Create "${action.payload.name}" from current low-stock products using ${action.payload.frequency} quantities.`;
  }

  if (action.type === ACTION_TYPES.CREATE_FLOOR_MAP) {
    return `Create a floor map named "${action.payload.name}"${action.payload.siteName ? ` for site "${action.payload.siteName}"` : ""}.`;
  }

  if (action.type === ACTION_TYPES.CREATE_STORAGE_UNIT) {
    return `Create storage unit "${action.payload.name}"${action.payload.floorMapName ? ` on "${action.payload.floorMapName}"` : ""}.`;
  }

  if (action.type === ACTION_TYPES.MOVE_STORAGE_UNIT) {
    return `Move "${action.payload.unitName}" to x ${action.payload.x}, y ${action.payload.y}.`;
  }

  if (action.type === ACTION_TYPES.RESIZE_STORAGE_UNIT) {
    return `Resize "${action.payload.unitName}" to ${action.payload.width} by ${action.payload.height}.`;
  }

  if (action.type === ACTION_TYPES.ASSIGN_STOCK_TO_UNIT) {
    return `Assign ${action.payload.quantity} of "${action.payload.productName}" to "${action.payload.unitName}".`;
  }

  if (action.type === ACTION_TYPES.OPEN_STORAGE_UNIT) {
    return `Open storage unit "${action.payload.unitName}".`;
  }

  if (action.type === ACTION_TYPES.SHOW_LOW_STOCK_FLOOR_MAP) {
    return "Open the floor map low-stock view.";
  }

  if (action.type === ACTION_TYPES.SHOW_FLOOR_MAP_EDITOR) {
    return "Open the floor map editor so the current layout can be saved.";
  }

  return `Create an empty shopping list named "${action.payload.name}".`;
}

function getQuotedValue(input) {
  const quoted = input.match(/["']([^"']{2,100})["']/);
  return quoted?.[1]?.trim() || null;
}

function valueAfter(input, words) {
  const pattern = new RegExp(
    `\\b(?:${words.join("|")})\\s+(.{2,100}?)(?=\\s+(?:to|at|on|in|for|with|width|height|size|called|named|x|y)\\b|[?.!]*$)`,
    "i",
  );
  const match = input.match(pattern);
  return match?.[1]?.replace(/[?.!]+$/, "").trim() || null;
}

function numberAfter(input, word) {
  const match = input.match(new RegExp(`\\b${word}\\s*(-?\\d+(?:\\.\\d+)?)\\b`, "i"));
  return match ? Number(match[1]) : null;
}

function dimensionsFrom(input) {
  const by = input.match(/\b(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)\b/i);
  const width = by ? Number(by[1]) : numberAfter(input, "width");
  const height = by ? Number(by[2]) : numberAfter(input, "height");
  return {
    width: width && width > 0 ? width : null,
    height: height && height > 0 ? height : null,
  };
}

function positionFrom(input) {
  const pair = input.match(/\bat\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\b/i);
  return {
    x: pair ? Number(pair[1]) : numberAfter(input, "x"),
    y: pair ? Number(pair[2]) : numberAfter(input, "y"),
  };
}

function storageUnitTypeFrom(input) {
  const match = input.match(/\b(shelf|cabinet|rack|drawer|fridge|other)\b/i);
  return match?.[1]?.toLowerCase() || "shelf";
}

function floorMapNameFrom(input) {
  return valueAfter(input, ["floor map", "floormap", "map"]);
}

function siteNameFrom(input) {
  const withLabel = input.match(
    /\b(?:for|on|in|at)\s+(?:the\s+)?(?:site|warehouse)\s+(.{2,100}?)(?=\s+(?:called|named|title(?:d)?|with (?:the )?name)\b|[?.!]*$)/i,
  );
  if (withLabel) return withLabel[1].replace(/[?.!]+$/, "").trim();

  const withoutLabel = input.match(
    /\b(?:for|on|in|at)\s+(.{2,100}?)(?=\s+(?:called|named|title(?:d)?|with (?:the )?name)\b|[?.!]*$)/i,
  );
  if (withoutLabel) return withoutLabel[1].replace(/[?.!]+$/, "").trim();

  return valueAfter(input, ["site", "warehouse"]);
}

function unitNameFrom(input) {
  return (
    getQuotedValue(input) ||
    valueAfter(input, ["storage unit", "unit", "shelf", "cabinet", "rack", "drawer", "fridge"])
  );
}

function destinationUnitNameFrom(input) {
  const match = input.match(
    /\b(?:to|in|on)\s+(?:(?:storage\s+unit|unit|shelf|cabinet|rack|drawer|fridge)\s+)?["']?(.{2,100}?)["']?[?.!]*$/i,
  );
  return match?.[1]?.trim() || unitNameFrom(input);
}

export function buildFloorMapAction(input) {
  const creates = /\b(create|make|add|new|build)\b/i.test(input);
  const floorMapMentioned = /\b(floor\s*map|floormap|map)\b/i.test(input);
  const unitMentioned = /\b(storage\s+unit|unit|shelf|cabinet|rack|drawer|fridge)\b/i.test(input);

  if (creates && floorMapMentioned && !unitMentioned) {
    const name = extractName(input, getQuotedValue(input) || "New floor map");
    const action = {
      id: makeActionId(ACTION_TYPES.CREATE_FLOOR_MAP),
      type: ACTION_TYPES.CREATE_FLOOR_MAP,
      title: "Create floor map",
      confirmLabel: "Create",
      payload: { name, siteName: siteNameFrom(input) },
    };
    action.summary = describeAction(action);
    return action;
  }

  if (creates && unitMentioned) {
    const { width, height } = dimensionsFrom(input);
    const { x, y } = positionFrom(input);
    const action = {
      id: makeActionId(ACTION_TYPES.CREATE_STORAGE_UNIT),
      type: ACTION_TYPES.CREATE_STORAGE_UNIT,
      title: "Create storage unit",
      confirmLabel: "Create",
      payload: {
        name: extractName(input, getQuotedValue(input) || "New storage unit"),
        type: storageUnitTypeFrom(input),
        floorMapName: floorMapNameFrom(input),
        width: width || 2,
        height: height || 1,
        x: x ?? 0,
        y: y ?? 0,
      },
    };
    action.summary = describeAction(action);
    return action;
  }

  if (/\b(move|place|position)\b/i.test(input) && unitMentioned) {
    const { x, y } = positionFrom(input);
    if (x === null || y === null) return null;
    const action = {
      id: makeActionId(ACTION_TYPES.MOVE_STORAGE_UNIT),
      type: ACTION_TYPES.MOVE_STORAGE_UNIT,
      title: "Move storage unit",
      confirmLabel: "Move",
      payload: { unitName: unitNameFrom(input), x, y },
    };
    action.summary = describeAction(action);
    return action;
  }

  if (/\b(resize|size|scale)\b/i.test(input) && unitMentioned) {
    const { width, height } = dimensionsFrom(input);
    if (!width || !height) return null;
    const action = {
      id: makeActionId(ACTION_TYPES.RESIZE_STORAGE_UNIT),
      type: ACTION_TYPES.RESIZE_STORAGE_UNIT,
      title: "Resize storage unit",
      confirmLabel: "Resize",
      payload: { unitName: unitNameFrom(input), width, height },
    };
    action.summary = describeAction(action);
    return action;
  }

  if (/\b(assign|put|place|set)\b/i.test(input) && /\b(stock|product|item|of)\b/i.test(input)) {
    const quantity = numberAfter(input, "assign") || numberAfter(input, "set") || 1;
    const productMatch = input.match(
      /\b(?:of|product|item)\s+["']?(.{2,100}?)["']?(?=\s+(?:to|in|on)\b)/i,
    );
    const action = {
      id: makeActionId(ACTION_TYPES.ASSIGN_STOCK_TO_UNIT),
      type: ACTION_TYPES.ASSIGN_STOCK_TO_UNIT,
      title: "Assign stock to unit",
      confirmLabel: "Assign",
      payload: {
        quantity,
        productName: productMatch?.[1]?.trim(),
        unitName: destinationUnitNameFrom(input),
      },
    };
    if (action.payload.productName && action.payload.unitName) {
      action.summary = describeAction(action);
      return action;
    }
  }

  if (/\b(open|show|go to|navigate to|take me to)\b/i.test(input) && unitMentioned) {
    const action = {
      id: makeActionId(ACTION_TYPES.OPEN_STORAGE_UNIT),
      type: ACTION_TYPES.OPEN_STORAGE_UNIT,
      title: "Open storage unit",
      confirmLabel: "Open",
      payload: { unitName: unitNameFrom(input) },
    };
    if (action.payload.unitName) {
      action.summary = describeAction(action);
      return action;
    }
  }

  if (floorMapMentioned && /\b(low[-\s]?stock|highlight|show low)\b/i.test(input)) {
    const action = {
      id: makeActionId(ACTION_TYPES.SHOW_LOW_STOCK_FLOOR_MAP),
      type: ACTION_TYPES.SHOW_LOW_STOCK_FLOOR_MAP,
      title: "Show low-stock floor map",
      confirmLabel: "Open",
      payload: {},
    };
    action.summary = describeAction(action);
    return action;
  }

  if (floorMapMentioned && /\b(save layout|save changes|layout changes|editor)\b/i.test(input)) {
    const action = {
      id: makeActionId(ACTION_TYPES.SHOW_FLOOR_MAP_EDITOR),
      type: ACTION_TYPES.SHOW_FLOOR_MAP_EDITOR,
      title: "Open floor map editor",
      confirmLabel: "Open",
      payload: {},
    };
    action.summary = describeAction(action);
    return action;
  }

  return null;
}

async function findOneByName(collection, orgId, name, label) {
  if (!name) throw new Meteor.Error("missing-name", `Tell me which ${label} to use.`);

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = await collection.findOneAsync({
    orgId,
    name: { $regex: new RegExp(`^${escaped}$`, "i") },
  });
  if (exact) return exact;

  const partials = await collection
    .find(
      {
        orgId,
        name: { $regex: new RegExp(escaped, "i") },
      },
      { limit: 2 },
    )
    .fetchAsync();

  if (partials.length === 1) return partials[0];
  if (partials.length > 1) {
    throw new Meteor.Error("ambiguous-match", `I found more than one ${label} matching "${name}".`);
  }

  throw new Meteor.Error("not-found", `I could not find a ${label} named "${name}".`);
}

async function getTargetSite(orgId, siteName) {
  if (siteName) return await findOneByName(Sites, orgId, siteName, "site");

  const sites = await Sites.find({ orgId }, { sort: { createdAt: 1 }, limit: 2 }).fetchAsync();
  if (sites.length === 1) return sites[0];
  if (sites.length > 1) {
    throw new Meteor.Error("site-required", "Tell me which site to create the floor map under.");
  }
  throw new Meteor.Error("site-required", "Create a site before creating a floor map.");
}

async function getTargetFloorMap(orgId, floorMapName) {
  if (floorMapName) return await findOneByName(FloorMaps, orgId, floorMapName, "floor map");

  const maps = await FloorMaps.find({ orgId }, { sort: { createdAt: 1 }, limit: 2 }).fetchAsync();
  if (maps.length === 1) return maps[0];
  if (maps.length > 1) {
    throw new Meteor.Error("floor-map-required", "Tell me which floor map to use.");
  }
  throw new Meteor.Error("floor-map-required", "Create a floor map before adding storage units.");
}

async function getTargetStorageUnit(orgId, unitName) {
  return await findOneByName(StorageUnits, orgId, unitName, "storage unit");
}

async function ensureStorageLocation(orgId, storageUnit) {
  const existing = await StorageLocations.findOneAsync(
    { orgId, storageUnitId: storageUnit._id },
    { sort: { createdAt: 1 } },
  );
  if (existing) return existing;

  const now = new Date();
  const codeBase = storageUnit.name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  const locationId = await StorageLocations.insertAsync({
    orgId,
    storageUnitId: storageUnit._id,
    name: storageUnit.name,
    code: codeBase || "UNIT",
    imageUrl: "",
    storedItems: [],
    lastStocktakeAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return await StorageLocations.findOneAsync(locationId);
}

async function syncProductTotal(productId, now) {
  const records = await ProductRecords.find(
    { productId },
    { fields: { quantity: 1 } },
  ).fetchAsync();
  const totalQuantity = records.reduce((sum, record) => sum + (record.quantity || 0), 0);
  await Products.updateAsync(productId, { $set: { totalQuantity, updatedAt: now } });
  return totalQuantity;
}

async function confirmFloorMapAction(userId, action) {
  const orgId = await getCallerOrgId(userId);
  if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

  if (action.type === ACTION_TYPES.SHOW_LOW_STOCK_FLOOR_MAP) {
    await requirePermission(userId, "chatbot.chat");
    return {
      text: "Opening the floor map. Low-stock units are highlighted in view mode.",
      url: "/floor-map?lowStock=1",
      openUrl: true,
    };
  }

  if (action.type === ACTION_TYPES.SHOW_FLOOR_MAP_EDITOR) {
    await requirePermission(userId, "locations.manage");
    return {
      text: "Opening the floor map editor. Use Save Layout for any unsaved canvas edits.",
      url: "/floor-map?edit=1",
      openUrl: true,
    };
  }

  if (action.type === ACTION_TYPES.OPEN_STORAGE_UNIT) {
    await requirePermission(userId, "chatbot.chat");
    const storageUnit = await getTargetStorageUnit(orgId, action.payload?.unitName);
    return {
      text: `Opening "${storageUnit.name}".`,
      url: `/locations/unit/${storageUnit._id}`,
      openUrl: true,
    };
  }

  await requirePermission(userId, "locations.manage");

  if (action.type === ACTION_TYPES.CREATE_FLOOR_MAP) {
    const name = String(action.payload?.name || "").trim();
    if (!name) throw new Meteor.Error("invalid-name", "Floor map name cannot be empty.");
    const site = await getTargetSite(orgId, action.payload?.siteName);
    const now = new Date();
    const floorMapId = await FloorMaps.insertAsync({
      orgId,
      siteId: site._id,
      name,
      imageUrl: "",
      floorSize: { width: 500, height: 500 },
      settings: {},
      createdAt: now,
      updatedAt: now,
    });
    return {
      text: `Confirmed. I created floor map "${name}".`,
      url: `/floor-map/${floorMapId}`,
      openUrl: true,
    };
  }

  if (action.type === ACTION_TYPES.CREATE_STORAGE_UNIT) {
    const name = String(action.payload?.name || "").trim();
    if (!name) throw new Meteor.Error("invalid-name", "Storage unit name cannot be empty.");
    const width = Number(action.payload?.width) || 2;
    const height = Number(action.payload?.height) || 1;
    const floorMap = await getTargetFloorMap(orgId, action.payload?.floorMapName);
    const now = new Date();
    const unitId = await StorageUnits.insertAsync({
      orgId,
      floorMapId: floorMap._id,
      name,
      type: action.payload?.type || "shelf",
      shape: { ...buildRectShape({ width, height, name }), orgId },
      offset: { x: Number(action.payload?.x) || 0, y: Number(action.payload?.y) || 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      fill: "#7a5230",
      createdAt: now,
      updatedAt: now,
    });
    return {
      text: `Confirmed. I created storage unit "${name}".`,
      url: `/floor-map/${floorMap._id}`,
      openUrl: true,
      unitId,
    };
  }

  if (action.type === ACTION_TYPES.MOVE_STORAGE_UNIT) {
    const storageUnit = await getTargetStorageUnit(orgId, action.payload?.unitName);
    await StorageUnits.updateAsync(storageUnit._id, {
      $set: {
        offset: { x: Number(action.payload?.x), y: Number(action.payload?.y) },
        updatedAt: new Date(),
      },
    });
    return {
      text: `Confirmed. I moved "${storageUnit.name}".`,
      url: `/floor-map/${storageUnit.floorMapId}`,
      openUrl: true,
    };
  }

  if (action.type === ACTION_TYPES.RESIZE_STORAGE_UNIT) {
    const storageUnit = await getTargetStorageUnit(orgId, action.payload?.unitName);
    const bounds = getBoundingBox(storageUnit.shape.points);
    const scale = {
      x: bounds.width > 0 ? Number(action.payload?.width) / bounds.width : 1,
      y: bounds.height > 0 ? Number(action.payload?.height) / bounds.height : 1,
    };
    await StorageUnits.updateAsync(storageUnit._id, {
      $set: { scale, updatedAt: new Date() },
    });
    return {
      text: `Confirmed. I resized "${storageUnit.name}".`,
      url: `/floor-map/${storageUnit.floorMapId}`,
      openUrl: true,
    };
  }

  if (action.type === ACTION_TYPES.ASSIGN_STOCK_TO_UNIT) {
    await requirePermission(userId, "products.adjustStock");
    const quantity = Number(action.payload?.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Meteor.Error(
        "invalid-quantity",
        "Quantity must be a whole number of zero or more.",
      );
    }
    const product = await findOneByName(Products, orgId, action.payload?.productName, "product");
    const storageUnit = await getTargetStorageUnit(orgId, action.payload?.unitName);
    const location = await ensureStorageLocation(orgId, storageUnit);
    const now = new Date();
    const record = await ProductRecords.findOneAsync({
      productId: product._id,
      locationId: location._id,
    });
    if (record) {
      await ProductRecords.updateAsync(record._id, { $set: { quantity, updatedAt: now } });
    } else {
      await ProductRecords.insertAsync({
        productId: product._id,
        locationId: location._id,
        quantity,
        createdAt: now,
        updatedAt: now,
      });
    }
    const totalQuantity = await syncProductTotal(product._id, now);
    return {
      text: `Confirmed. I assigned ${quantity} of "${product.name}" to "${storageUnit.name}". Total stock is now ${totalQuantity}.`,
      url: `/locations/unit/${storageUnit._id}`,
      openUrl: true,
    };
  }

  throw new Meteor.Error("unknown-action", "I do not know how to confirm that action.");
}

export function buildShoppingListAction(input, previousAction) {
  const lowStockRequested =
    /\b(low[-\s]?stock|reorder|restock|checklist)\b/i.test(input) &&
    /\b(list|checklist|shopping|buy|order|make|create|generate|build)\b/i.test(input);
  const shoppingListRequested =
    /\b(shopping\s+list|list)\b/i.test(input) &&
    /\b(create|make|generate|build|new)\b/i.test(input);

  if (!previousAction && !lowStockRequested && !shoppingListRequested) return null;

  const type =
    previousAction?.type ||
    (lowStockRequested ? ACTION_TYPES.CREATE_LOW_STOCK_LIST : ACTION_TYPES.CREATE_SHOPPING_LIST);
  const fallbackName =
    previousAction?.payload?.name ||
    (type === ACTION_TYPES.CREATE_LOW_STOCK_LIST ? "Low-stock checklist" : "New shopping list");
  const payload = {
    name:
      extractName(input, null) ||
      (previousAction ? extractPendingActionName(input, null) : null) ||
      fallbackName,
  };

  if (type === ACTION_TYPES.CREATE_LOW_STOCK_LIST) {
    payload.frequency = frequencyFrom(input, previousAction?.payload?.frequency);
  }

  const action = {
    id: makeActionId(type),
    type,
    title:
      type === ACTION_TYPES.CREATE_LOW_STOCK_LIST
        ? "Create low-stock checklist"
        : "Create shopping list",
    confirmLabel: "Confirm",
    payload,
  };

  action.summary = describeAction(action);
  return action;
}

async function confirmAction(userId, action) {
  await requirePermission(userId, "shoppingLists.create");

  const orgId = await getCallerOrgId(userId);
  if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

  const name = String(action.payload?.name || "").trim();
  if (!name) throw new Meteor.Error("invalid-name", "List name cannot be empty.");

  let items = [];
  if (action.type === ACTION_TYPES.CREATE_LOW_STOCK_LIST) {
    const frequency = frequencyFrom(action.payload?.frequency || "", LIST_FREQUENCIES.WEEKLY);
    const products = await Products.find({ orgId }).fetchAsync();
    items = products
      .filter(isLowStock)
      .map((product) => toItem(product, frequency, ADD_PRODUCT_MODES.GENERATED));
  }

  const now = new Date();
  const listId = await ShoppingLists.insertAsync({
    orgId,
    createdBy: userId,
    name,
    origin: LIST_ORIGINS.MANUAL,
    items,
    createdAt: now,
    updatedAt: now,
  });

  return {
    text: `Confirmed. I created "${name}"${items.length ? ` with ${items.length} item${items.length === 1 ? "" : "s"}` : ""}.`,
    listId,
    url: `/lists/${listId}`,
  };
}

function toGeminiContents(messages) {
  return messages
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content.trim().slice(0, MAX_MESSAGE_LENGTH) }],
    }))
    .filter((message) => message.parts[0].text.length > 0);
}

const AFFIRMATION = /^\s*(confirm|confirmed|yes|y|yep|ok|okay|go ahead|do it)\W*$/i;

// True when the user's latest message is just a CONFIRM/yes replying to an
// assistant message that asked them to confirm.
function isConfirmationReply(messages, input) {
  const previous = messages.slice(0, -1).at(-1);
  return (
    AFFIRMATION.test(input) && previous?.role === "assistant" && /confirm/i.test(previous.content)
  );
}

// generateContent wants function declarations without our "type: function" wrapper.
function toFunctionDeclarations(tools) {
  return tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parametersJsonSchema: parameters,
  }));
}

async function createChatbotResponse({ ai, model, contents, tools }) {
  return await ai.models.generateContent({
    model,
    contents,
    config: {
      maxOutputTokens: getNumberSetting("GEMINI_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS),
      temperature: getNumberSetting("GEMINI_TEMPERATURE", DEFAULT_TEMPERATURE),
      systemInstruction: SYSTEM_INSTRUCTION,
      ...(tools.length ? { tools: [{ functionDeclarations: toFunctionDeclarations(tools) }] } : {}),
    },
  });
}

Meteor.methods({
  async "chatbot.chat"({ messages, previousInteractionId, pendingAction }) {
    check(messages, [
      {
        role: Match.Where((value) => value === "user" || value === "assistant"),
        content: String,
        actions: Match.Optional([actionPattern]),
      },
    ]);
    check(previousInteractionId, Match.Maybe(String));
    check(pendingAction, Match.Maybe(actionPattern));

    await requirePermission(this.userId, "chatbot.chat");

    const input = getLatestUserInput(messages);
    if (!input) {
      throw new Meteor.Error("empty-message", "Ask something first.");
    }

    const action = buildShoppingListAction(input, pendingAction) || buildFloorMapAction(input);
    if (action) {
      return {
        text: pendingAction
          ? "I updated the pending action. Confirm it when it looks right, or keep describing changes."
          : "I can set that up. Please confirm before I make any changes.",
        interactionId: previousInteractionId,
        suggestedActions: [action],
      };
    }

    const model = getSetting("GEMINI_MODEL") || DEFAULT_MODEL;

    const userId = this.userId;
    const permissionNames = new Set();
    for (const permission of TOOL_PERMISSIONS) {
      if (await hasPermission(userId, permission)) permissionNames.add(permission);
    }
    const tools = buildToolDeclarations((permission) => permissionNames.has(permission));
    const allowedToolNames = new Set(tools.map((tool) => tool.name));
    const actions = [];
    const turn = ++chatTurn;
    const userConfirmed = isConfirmationReply(messages, input);

    try {
      const ai = getAiClient();
      let contents = toGeminiContents(messages);
      let response = await createChatbotResponse({ ai, model, contents, tools });

      // Run any tool calls the model asks for, as this user, and feed results back.
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const calls = response.functionCalls || [];
        if (calls.length === 0) break;

        const parts = [];
        for (const call of calls) {
          const result = await executeTool({
            userId,
            toolName: call.name,
            args: call.args,
            turn,
            userConfirmed,
            allowedToolNames,
            actions,
          });
          parts.push({
            functionResponse: {
              name: call.name,
              response: result,
              ...(call.id ? { id: call.id } : {}),
            },
          });
        }

        // Replay the model's own turn untouched (it carries thought signatures).
        contents = [...contents, response.candidates[0].content, { role: "user", parts }];
        response = await createChatbotResponse({ ai, model, contents, tools });
      }

      return {
        text: response.text || "I could not generate a response this time.",
        interactionId: response.responseId,
        model,
        suggestedActions: [],
        actions,
      };
    } catch (error) {
      console.error("chatbot.chat failed:", error);
      if (error instanceof Meteor.Error) {
        throw error;
      }
      throw new Meteor.Error("gemini-request-failed", DEFAULT_ERROR_MESSAGE);
    }
  },

  async "chatbot.confirmAction"({ action }) {
    check(action, actionPattern);
    await requirePermission(this.userId, "chatbot.chat");
    if (
      [
        ACTION_TYPES.CREATE_FLOOR_MAP,
        ACTION_TYPES.CREATE_STORAGE_UNIT,
        ACTION_TYPES.MOVE_STORAGE_UNIT,
        ACTION_TYPES.RESIZE_STORAGE_UNIT,
        ACTION_TYPES.ASSIGN_STOCK_TO_UNIT,
        ACTION_TYPES.OPEN_STORAGE_UNIT,
        ACTION_TYPES.SHOW_LOW_STOCK_FLOOR_MAP,
        ACTION_TYPES.SHOW_FLOOR_MAP_EDITOR,
      ].includes(action.type)
    ) {
      return await confirmFloorMapAction(this.userId, action);
    }
    return await confirmAction(this.userId, action);
  },

  "chatbot.configStatus"() {
    if (!Meteor.isDevelopment) {
      throw new Meteor.Error("not-available", "Only available in development.");
    }

    return getChatbotConfigStatus();
  },
});

Meteor.startup(() => {
  if (!Meteor.isDevelopment) return;

  const status = getChatbotConfigStatus();
  console.info(
    `chatbot config: apiKey=${status.hasApiKey ? "loaded" : "missing"} source=${status.keySource} model=${status.model}`,
  );
});
