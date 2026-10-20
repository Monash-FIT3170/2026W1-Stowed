import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { getCallerOrgId, hasPermission, requirePermission } from "../userMethods";
import { buildToolDeclarations, callMethodAs, executeTool, TOOL_PERMISSIONS } from "./tools";
import { permissionForAction } from "./actionPermissions";
import { FloorMaps, Sites, StorageLocations, StorageUnits } from "../locations/collections";
import { buildRectShape, getBoundingBox } from "../locations/shapeUtils";
import { Products } from "../products/collections";
import { DIRECTIONS_CHOICE_KINDS, resolveDirections } from "./directions";
import { ShoppingLists } from "../shoppingLists/collections";
import { getPromptHelp } from "./prompts";
import { ADD_PRODUCT_MODES, LIST_FREQUENCIES, LIST_ORIGINS } from "../shoppingLists/constants";
import { isLowStock, toItem } from "../shoppingLists/generation";
import {
  DEFAULT_STOCKTAKE_INTERVAL_DAYS,
  describeStocktakeTiming,
  getStocktakeAlerts,
  STOCKTAKE_STATUS,
} from "../locations/stocktake";

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_TOOL_ROUNDS = 5;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_MAX_OUTPUT_TOKENS = 256;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_ERROR_MESSAGE = "Sorry, we cannot help with that right now.";
const MISSING_API_KEY_MESSAGE =
  "The AI Assistant needs a Gemini API key before it can answer that. Add GEMINI_API_KEY to your .env file (or settings.json) and restart Meteor.";
export const ACTION_TYPES = {
  CREATE_SHOPPING_LIST: "createShoppingList",
  CREATE_LOW_STOCK_LIST: "createLowStockShoppingList",
  CREATE_SITE: "createSite",
  CREATE_FLOOR_MAP: "createFloorMap",
  CREATE_STORAGE_UNIT: "createStorageUnit",
  CREATE_STORAGE_LOCATION: "createStorageLocation",
  MOVE_STORAGE_UNIT: "moveStorageUnit",
  RESIZE_STORAGE_UNIT: "resizeStorageUnit",
  ASSIGN_STOCK_TO_UNIT: "assignStockToUnit",
  OPEN_STORAGE_UNIT: "openStorageUnit",
  SHOW_LOW_STOCK_FLOOR_MAP: "showLowStockFloorMap",
  SHOW_FLOOR_MAP_EDITOR: "showFloorMapEditor",
};
const SHOPPING_LIST_ACTION_TYPES = new Set([
  ACTION_TYPES.CREATE_SHOPPING_LIST,
  ACTION_TYPES.CREATE_LOW_STOCK_LIST,
]);
const FLOOR_MAP_ACTION_TYPES = new Set([
  ACTION_TYPES.CREATE_SITE,
  ACTION_TYPES.CREATE_FLOOR_MAP,
  ACTION_TYPES.CREATE_STORAGE_UNIT,
  ACTION_TYPES.CREATE_STORAGE_LOCATION,
  ACTION_TYPES.MOVE_STORAGE_UNIT,
  ACTION_TYPES.RESIZE_STORAGE_UNIT,
  ACTION_TYPES.ASSIGN_STOCK_TO_UNIT,
  ACTION_TYPES.OPEN_STORAGE_UNIT,
  ACTION_TYPES.SHOW_LOW_STOCK_FLOOR_MAP,
  ACTION_TYPES.SHOW_FLOOR_MAP_EDITOR,
]);
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
  "If the user asks for something outside Stowed's inventory scope, briefly say you can only help with Stowed tasks.",
  "You cannot create, edit or delete user accounts. If asked, say only an owner can manage accounts, from the Accounts page.",
  "Use the tools to look things up and to act for the user; never invent product or location ids.",
  "You can only use the tools you are given - they match the user's role. If asked for something outside them, say you can't do that with their account.",
  "To create, edit or delete a product: first call the tool WITHOUT confirmed (this only previews, nothing changes), then tell the user exactly what will change and end your message with: Reply CONFIRM to proceed.",
  "If the user's next message is CONFIRM (any capitalisation, or a plain yes), immediately call the same tool again with exactly the same arguments plus confirmed true - do not ask again. Any other reply cancels the change.",
  "To create staff accounts, you need a username and email for each person. Ask for anything missing, and never ask for or mention a password. Role is standard unless the user says admin.",
  "Call createUser once per person WITHOUT confirmed first, then list every account (username, email, role) in one message and end with: Reply CONFIRM to proceed. When they confirm, call createUser again for every listed account with confirmed true.",
  "After an account is created, say the person will get an email to set their password. If passwordEmailSent is false, say they can use Forgot password on the login page instead.",
  "When asked to take the user somewhere, use the navigate tool. Keep replies short.",
  "When the user asks where a product is, how to get to it, or for directions, call getDirections with the product names they said. It asks any follow-up questions itself with on-screen choices, so never ask the user to type ids or pick from a list in text.",
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
      "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file (or settings.json) and restart Meteor.",
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

  if (action.type === ACTION_TYPES.CREATE_SITE) {
    return `Create a site named "${action.payload.name}".`;
  }

  if (action.type === ACTION_TYPES.CREATE_FLOOR_MAP) {
    return `Create a floor map named "${action.payload.name}"${action.payload.siteName ? ` for site "${action.payload.siteName}"` : ""}.`;
  }

  if (action.type === ACTION_TYPES.CREATE_STORAGE_UNIT) {
    return `Create storage unit "${action.payload.name}"${action.payload.floorMapName ? ` on "${action.payload.floorMapName}"` : ""}.`;
  }

  if (action.type === ACTION_TYPES.CREATE_STORAGE_LOCATION) {
    return `Create storage location "${action.payload.name}"${action.payload.unitName ? ` in "${action.payload.unitName}"` : ""}.`;
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
  const cleanSiteName = (value) =>
    value
      ?.replace(/[?.!]+$/, "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim() || null;
  const withLabel = input.match(
    /\b(?:for|on|in|at)\s+(?:the\s+)?(?:site|warehouse)\s+(.{2,100}?)(?=\s+(?:called|named|title(?:d)?|with (?:the )?name)\b|[?.!]*$)/i,
  );
  if (withLabel) return cleanSiteName(withLabel[1]);

  const withoutLabel = input.match(
    /\b(?:for|on|in|at)\s+(.{2,100}?)(?=\s+(?:called|named|title(?:d)?|with (?:the )?name)\b|[?.!]*$)/i,
  );
  if (withoutLabel) return cleanSiteName(withoutLabel[1]);

  return cleanSiteName(valueAfter(input, ["site", "warehouse"]));
}

function unitNameFrom(input) {
  return (
    getQuotedValue(input) ||
    valueAfter(input, ["storage unit", "unit", "shelf", "cabinet", "rack", "drawer", "fridge"])
  );
}

function locationNameFrom(input) {
  return (
    getQuotedValue(input) ||
    extractName(input, null) ||
    valueAfter(input, ["storage location", "location", "bay", "bin"]) ||
    "New storage location"
  );
}

function storageLocationCodeFrom(name) {
  return String(name || "LOC")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

function destinationUnitNameFrom(input) {
  const match = input.match(
    /\b(?:to|in|on)\s+(?:(?:storage\s+unit|unit|shelf|cabinet|rack|drawer|fridge)\s+)?["']?(.{2,100}?)["']?[?.!]*$/i,
  );
  return match?.[1]?.trim() || unitNameFrom(input);
}

export function buildFloorMapAction(input) {
  const creates = /\b(create|make|add|new|build)\b/i.test(input);
  const siteMentioned = /\b(site|warehouse)\b/i.test(input);
  const storageLocationMentioned = /\b(storage\s+location|location|bay|bin)\b/i.test(input);
  const floorMapMentioned = /\b(floor\s*map|floormap|map)\b/i.test(input);
  const unitMentioned = /\b(storage\s+unit|unit|shelf|cabinet|rack|drawer|fridge)\b/i.test(input);

  if (creates && siteMentioned && !floorMapMentioned && !unitMentioned) {
    const action = {
      id: makeActionId(ACTION_TYPES.CREATE_SITE),
      type: ACTION_TYPES.CREATE_SITE,
      title: "Create site",
      confirmLabel: "Create",
      payload: { name: extractName(input, getQuotedValue(input) || "New site") },
    };
    action.summary = describeAction(action);
    return action;
  }

  if (creates && storageLocationMentioned && !floorMapMentioned) {
    const name = locationNameFrom(input);
    const action = {
      id: makeActionId(ACTION_TYPES.CREATE_STORAGE_LOCATION),
      type: ACTION_TYPES.CREATE_STORAGE_LOCATION,
      title: "Create storage location",
      confirmLabel: "Create",
      payload: {
        name,
        unitName: unitNameFrom(input),
        code: storageLocationCodeFrom(name),
      },
    };
    action.summary = describeAction(action);
    return action;
  }

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

export function buildPendingFloorMapAction(input, previousAction) {
  if (!previousAction || !FLOOR_MAP_ACTION_TYPES.has(previousAction.type)) return null;

  const payload = { ...previousAction.payload };
  const nextName =
    extractPendingActionName(input, null) ||
    (previousAction.type === ACTION_TYPES.CREATE_FLOOR_MAP && /\b(named|called)\b/i.test(input)
      ? extractName(input, null)
      : null);
  if (previousAction.type === ACTION_TYPES.CREATE_FLOOR_MAP) {
    const siteName = siteNameFrom(input);
    if (siteName) payload.siteName = siteName;
  }
  if (nextName) {
    if (
      previousAction.type === ACTION_TYPES.CREATE_SITE ||
      previousAction.type === ACTION_TYPES.CREATE_FLOOR_MAP ||
      previousAction.type === ACTION_TYPES.CREATE_STORAGE_UNIT ||
      previousAction.type === ACTION_TYPES.CREATE_STORAGE_LOCATION
    ) {
      payload.name = nextName;
    } else if (
      [
        ACTION_TYPES.MOVE_STORAGE_UNIT,
        ACTION_TYPES.RESIZE_STORAGE_UNIT,
        ACTION_TYPES.OPEN_STORAGE_UNIT,
      ].includes(previousAction.type)
    ) {
      payload.unitName = nextName;
    }
  }

  const { width, height } = dimensionsFrom(input);
  if (width) payload.width = width;
  if (height) payload.height = height;

  const { x, y } = positionFrom(input);
  if (x !== null) payload.x = x;
  if (y !== null) payload.y = y;

  const action = {
    ...previousAction,
    id: makeActionId(previousAction.type),
    payload,
  };
  action.summary = describeAction(action);
  return action;
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
  if (!unitName) {
    const units = await StorageUnits.find(
      { orgId },
      { sort: { createdAt: 1 }, limit: 2 },
    ).fetchAsync();
    if (units.length === 1) return units[0];
    if (units.length > 1) {
      throw new Meteor.Error("storage-unit-required", "Tell me which storage unit to use.");
    }
    throw new Meteor.Error(
      "storage-unit-required",
      "Create a storage unit before adding locations.",
    );
  }
  return await findOneByName(StorageUnits, orgId, unitName, "storage unit");
}

async function ensureStorageLocation(userId, orgId, storageUnit) {
  const existing = await StorageLocations.findOneAsync(
    { orgId, storageUnitId: storageUnit._id },
    { sort: { createdAt: 1 } },
  );
  if (existing) return existing;

  const codeBase = storageUnit.name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  const locationId = await callMethodAs(userId, "storageLocations.create", {
    storageUnitId: storageUnit._id,
    name: storageUnit.name,
    code: codeBase || "UNIT",
    imageUrl: "",
  });

  return await StorageLocations.findOneAsync(locationId);
}

async function updateStorageUnitAs(userId, storageUnit, changes) {
  await callMethodAs(userId, "storageUnits.update", {
    storageUnitId: storageUnit._id,
    floorMapId: storageUnit.floorMapId,
    name: storageUnit.name,
    type: storageUnit.type,
    shape: storageUnit.shape,
    offset: storageUnit.offset || { x: 0, y: 0 },
    rotation: storageUnit.rotation || 0,
    scale: storageUnit.scale || { x: 1, y: 1 },
    ...(storageUnit.fill !== undefined ? { fill: storageUnit.fill } : {}),
    ...changes,
  });
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

  if (action.type === ACTION_TYPES.CREATE_SITE) {
    const name = String(action.payload?.name || "").trim();
    if (!name) throw new Meteor.Error("invalid-name", "Site name cannot be empty.");
    const siteId = await callMethodAs(userId, "sites.create", {
      name,
      description: "",
      stocktakeIntervalDays: DEFAULT_STOCKTAKE_INTERVAL_DAYS,
    });
    return {
      text: `Confirmed. I created site "${name}".`,
      url: "/locations?tab=sites",
      openUrl: true,
      siteId,
    };
  }

  if (action.type === ACTION_TYPES.CREATE_FLOOR_MAP) {
    const name = String(action.payload?.name || "").trim();
    if (!name) throw new Meteor.Error("invalid-name", "Floor map name cannot be empty.");
    const site = await getTargetSite(orgId, action.payload?.siteName);
    const floorMapId = await callMethodAs(userId, "floorMaps.create", {
      siteId: site._id,
      name,
      imageUrl: "",
      floorSize: { width: 500, height: 500 },
      settings: {},
    });
    return {
      text: `Confirmed. I created floor map "${name}".`,
      url: `/floor-map/${floorMapId}`,
      openUrl: true,
      floorMapId,
    };
  }

  if (action.type === ACTION_TYPES.CREATE_STORAGE_UNIT) {
    const name = String(action.payload?.name || "").trim();
    if (!name) throw new Meteor.Error("invalid-name", "Storage unit name cannot be empty.");
    const width = Number(action.payload?.width) || 2;
    const height = Number(action.payload?.height) || 1;
    const floorMap = await getTargetFloorMap(orgId, action.payload?.floorMapName);
    const unitId = await callMethodAs(userId, "storageUnits.create", {
      floorMapId: floorMap._id,
      name,
      type: action.payload?.type || "shelf",
      shape: buildRectShape({ width, height, name }),
      offset: { x: Number(action.payload?.x) || 0, y: Number(action.payload?.y) || 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      fill: "#7a5230",
    });
    return {
      text: `Confirmed. I created storage unit "${name}".`,
      url: `/floor-map/${floorMap._id}`,
      openUrl: true,
      unitId,
    };
  }

  if (action.type === ACTION_TYPES.CREATE_STORAGE_LOCATION) {
    const name = String(action.payload?.name || "").trim();
    if (!name) throw new Meteor.Error("invalid-name", "Storage location name cannot be empty.");
    const storageUnit = await getTargetStorageUnit(orgId, action.payload?.unitName);
    const code = String(action.payload?.code || storageLocationCodeFrom(name)).trim();
    const locationId = await callMethodAs(userId, "storageLocations.create", {
      storageUnitId: storageUnit._id,
      name,
      code,
      imageUrl: "",
    });
    return {
      text: `Confirmed. I created storage location "${name}".`,
      url: `/locations/unit/${storageUnit._id}`,
      openUrl: true,
      locationId,
    };
  }

  if (action.type === ACTION_TYPES.MOVE_STORAGE_UNIT) {
    const storageUnit = await getTargetStorageUnit(orgId, action.payload?.unitName);
    await updateStorageUnitAs(userId, storageUnit, {
      offset: { x: Number(action.payload?.x), y: Number(action.payload?.y) },
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
    await updateStorageUnitAs(userId, storageUnit, { scale });
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
    const location = await ensureStorageLocation(userId, orgId, storageUnit);
    const { newTotal } = await callMethodAs(userId, "products.setStock", {
      productId: product._id,
      locationId: location._id,
      quantity,
    });
    return {
      text: `Confirmed. I assigned ${quantity} of "${product.name}" to "${storageUnit.name}". Total stock is now ${newTotal}.`,
      url: `/locations/unit/${storageUnit._id}`,
      openUrl: true,
    };
  }

  throw new Meteor.Error("unknown-action", "I do not know how to confirm that action.");
}

export function buildShoppingListAction(input, previousAction) {
  const previousShoppingListAction =
    previousAction && SHOPPING_LIST_ACTION_TYPES.has(previousAction.type) ? previousAction : null;
  const lowStockRequested =
    /\b(low[-\s]?stock|reorder|restock|checklist)\b/i.test(input) &&
    /\b(list|checklist|shopping|buy|order|make|create|generate|build)\b/i.test(input);
  const shoppingListRequested =
    /\b(shopping\s+list|list)\b/i.test(input) &&
    /\b(create|make|generate|build|new)\b/i.test(input);

  if (!previousShoppingListAction && !lowStockRequested && !shoppingListRequested) return null;

  const type =
    previousShoppingListAction?.type ||
    (lowStockRequested ? ACTION_TYPES.CREATE_LOW_STOCK_LIST : ACTION_TYPES.CREATE_SHOPPING_LIST);
  const fallbackName =
    previousShoppingListAction?.payload?.name ||
    (type === ACTION_TYPES.CREATE_LOW_STOCK_LIST ? "Low-stock checklist" : "New shopping list");
  const payload = {
    name:
      extractName(input, null) ||
      (previousShoppingListAction ? extractPendingActionName(input, null) : null) ||
      fallbackName,
  };

  if (type === ACTION_TYPES.CREATE_LOW_STOCK_LIST) {
    payload.frequency = frequencyFrom(input, previousShoppingListAction?.payload?.frequency);
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

// Every suggested action maps to the permission the app itself requires; unknown
// types are refused. Runs before anything else so each action goes through one check.
async function requireActionPermission(userId, action) {
  const permission = permissionForAction(action.type);
  if (!permission) throw new Meteor.Error("forbidden", "That action isn't available.");
  await requirePermission(userId, permission);
}

async function runSuggestedAction(userId, action) {
  await requireActionPermission(userId, action);
  if (FLOOR_MAP_ACTION_TYPES.has(action.type)) {
    return await confirmFloorMapAction(userId, action);
  }
  return await confirmAction(userId, action);
}

const selectionPattern = {
  kind: String,
  values: [String],
  context: Match.Optional(Object),
};

async function answerDirectionsSelection(userId, selection) {
  const context = selection.context ?? {};
  const strings = (value) =>
    Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  const contextIds = strings(context.productIds);
  const siteId = typeof context.siteId === "string" ? context.siteId : undefined;

  if (selection.kind === DIRECTIONS_CHOICE_KINDS.SITE) {
    return await resolveDirections({
      userId,
      productIds: contextIds,
      productQueries: strings(context.productQueries),
      siteId: selection.values[0],
    });
  }
  if (selection.kind === DIRECTIONS_CHOICE_KINDS.PRODUCTS) {
    return await resolveDirections({
      userId,
      productIds: [...new Set([...contextIds, ...selection.values])],
      siteId,
    });
  }
  if (selection.kind === DIRECTIONS_CHOICE_KINDS.FLOOR) {
    return await resolveDirections({
      userId,
      productIds: contextIds,
      floorMapId: selection.values[0],
      siteId,
    });
  }
  return null;
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
const STOCKTAKE_RECOMMENDATION_REQUEST =
  /\b(?:what|which|where|show|list|tell|any|should|need)\b.*\bstock\s*take\b|\bstock\s*take\b.*\b(?:today|due|overdue|next|should|need)\b/i;
const STORAGE_LOCATION_NAMING_REQUEST =
  /\b(?:help|suggest|name|naming|ideas|recommend)\b.*\bstorage\s+locations?\b|\bstorage\s+locations?\b.*\b(?:name|naming|ideas|suggest|recommend)\b/i;
const ARCHIVE_SHOPPING_LIST_REQUEST =
  /\b(?:archive|achive|achieve)\b.*\b(?:shopping|shoping|shaping)\s+lists?\b|\b(?:shopping|shoping|shaping)\s+lists?\b.*\b(?:archive|achive|achieve)\b/i;

// True when the user's latest message is just a CONFIRM/yes replying to an
// assistant message that asked them to confirm.
function isConfirmationReply(messages, input) {
  const previous = messages.slice(0, -1).at(-1);
  return (
    AFFIRMATION.test(input) && previous?.role === "assistant" && /confirm/i.test(previous.content)
  );
}

async function buildStocktakeRecommendation(userId) {
  await requirePermission(userId, "route:/stocktake");
  const orgId = await getCallerOrgId(userId);
  if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

  const sites = await Sites.find({ orgId }).fetchAsync();
  const floorMaps = await FloorMaps.find({
    orgId,
    siteId: { $in: sites.map((site) => site._id) },
  }).fetchAsync();
  const storageUnits = await StorageUnits.find({
    orgId,
    floorMapId: { $in: floorMaps.map((floorMap) => floorMap._id) },
  }).fetchAsync();
  const storageLocations = await StorageLocations.find({
    orgId,
    storageUnitId: { $in: storageUnits.map((unit) => unit._id) },
  }).fetchAsync();

  const alerts = getStocktakeAlerts({
    storageLocations,
    storageUnits,
    floorMaps,
    sites,
    statuses: [STOCKTAKE_STATUS.OVERDUE, STOCKTAKE_STATUS.DUE_SOON],
  });

  if (alerts.length === 0) {
    return {
      text: "No locations are overdue or due soon for stocktake today.",
      suggestedActions: [],
      actions: [],
    };
  }

  const lines = alerts.slice(0, 5).map((alert, index) => {
    const timing = describeStocktakeTiming(alert.daysUntilDue);
    const path = alert.path ? ` (${alert.path})` : "";
    return `${index + 1}. ${alert.location.name}${path} - ${timing}`;
  });
  const first = alerts[0];

  return {
    text: `Stocktake these first:\n${lines.join("\n")}\n\nMost urgent: ${first.location.name}. Open /stocktake/${first.location._id} to start.`,
    suggestedActions: [],
    actions: [],
  };
}

function codePrefixFor(value) {
  return String(value || "LOC")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);
}

async function buildStorageLocationNamingHelp(userId) {
  await requirePermission(userId, "route:/locations");
  const orgId = await getCallerOrgId(userId);
  if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

  const storageUnits = await StorageUnits.find({ orgId }, { sort: { name: 1 } }).fetchAsync();
  if (storageUnits.length === 0) {
    return {
      text: [
        "Use names that tell staff exactly where to go.",
        "Good patterns:",
        "1. Aisle 1 Bay 01 - code A1-B01",
        "2. Fridge 1 Shelf 01 - code F1-S01",
        "3. Cabinet A Drawer 01 - code CA-D01",
      ].join("\n"),
      suggestedActions: [],
      actions: [],
    };
  }

  const locations = await StorageLocations.find({
    orgId,
    storageUnitId: { $in: storageUnits.map((unit) => unit._id) },
  }).fetchAsync();
  const locationsByUnit = new Map();
  for (const location of locations) {
    const existing = locationsByUnit.get(location.storageUnitId) || [];
    existing.push(location);
    locationsByUnit.set(location.storageUnitId, existing);
  }

  const suggestions = storageUnits.slice(0, 3).map((unit, index) => {
    const nextNumber = (locationsByUnit.get(unit._id)?.length || 0) + 1;
    const padded = String(nextNumber).padStart(2, "0");
    const prefix = codePrefixFor(unit.name);
    return `${index + 1}. ${unit.name} Bay ${padded} - code ${prefix}-${padded}`;
  });

  return {
    text: [
      "Try a consistent unit + bay pattern so labels sort cleanly.",
      ...suggestions,
      "Keep codes short, uppercase, and printed on the label.",
    ].join("\n"),
    suggestedActions: [],
    actions: [],
  };
}

async function buildArchiveShoppingListHelp(userId) {
  await requirePermission(userId, "route:/lists");
  return {
    text: "Opening Lists. Choose the shopping list you want to archive, then use Archive on its detail page.",
    url: "/lists",
    openUrl: true,
    suggestedActions: [],
    actions: [],
  };
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
        selection: Match.Optional(selectionPattern),
      },
    ]);
    check(previousInteractionId, Match.Maybe(String));
    check(pendingAction, Match.Maybe(actionPattern));

    await requirePermission(this.userId, "chatbot.chat");

    const input = getLatestUserInput(messages);
    if (!input) {
      throw new Meteor.Error("empty-message", "Ask something first.");
    }

    const latestMessage = messages.at(-1);
    if (latestMessage?.role === "user" && latestMessage.selection) {
      await requirePermission(this.userId, "floorMapRoutes.generate");
      const answer = await answerDirectionsSelection(this.userId, latestMessage.selection);
      if (answer) {
        return {
          text: answer.message,
          interactionId: previousInteractionId,
          suggestedActions: [],
          actions: answer.actions,
        };
      }
    }

    if (
      /^(?:help|(?:show|list)(?: me)?(?: all)?(?: the)? prompts|what can you do)[?.!]*$/i.test(
        input,
      )
    ) {
      return {
        text: getPromptHelp(),
        interactionId: previousInteractionId,
        suggestedActions: pendingAction ? [pendingAction] : [],
        actions: [],
      };
    }

    if (pendingAction && AFFIRMATION.test(input)) {
      const result = await runSuggestedAction(this.userId, pendingAction);
      return {
        ...result,
        interactionId: previousInteractionId,
        suggestedActions: [],
        actions: [],
      };
    }

    if (STOCKTAKE_RECOMMENDATION_REQUEST.test(input)) {
      return {
        ...(await buildStocktakeRecommendation(this.userId)),
        interactionId: previousInteractionId,
      };
    }

    if (STORAGE_LOCATION_NAMING_REQUEST.test(input)) {
      return {
        ...(await buildStorageLocationNamingHelp(this.userId)),
        interactionId: previousInteractionId,
      };
    }

    if (ARCHIVE_SHOPPING_LIST_REQUEST.test(input)) {
      return {
        ...(await buildArchiveShoppingListHelp(this.userId)),
        interactionId: previousInteractionId,
      };
    }

    if (
      /^(?:please\s+)?(?:create|make|add|build)(?:\s+(?:me|a|new|the))*\s+(?:floor\s*map|floormap)[.!?]*$/i.test(
        input,
      )
    ) {
      const orgId = await getCallerOrgId(this.userId);
      const sites = orgId
        ? await Sites.find({ orgId }, { sort: { name: 1 }, limit: 5 }).fetchAsync()
        : [];
      const exampleSite = sites[0]?.name || "Harbour";
      return {
        text: [
          "To create a floor map, provide a map name and the site it belongs to.",
          `Example: Create a floor map named "H3" in site ${JSON.stringify(exampleSite)}.`,
          sites.length
            ? `Available sites: ${sites.map((site) => JSON.stringify(site.name)).join(", ")}.`
            : 'Create a site first, for example: Create a site named "Harbour".',
          "Replace H3 with your map name and use an existing site name. I’ll show the details for you to confirm before creating it.",
        ].join("\n\n"),
        interactionId: previousInteractionId,
        activeTask: "createFloorMap",
        suggestedActions: [],
        actions: [],
      };
    }

    const action =
      buildShoppingListAction(input, pendingAction) ||
      buildPendingFloorMapAction(input, pendingAction) ||
      buildFloorMapAction(input);
    if (action) {
      const requiredPermission = permissionForAction(action.type);
      if (!requiredPermission || !(await hasPermission(this.userId, requiredPermission))) {
        return {
          text: "Your account role doesn't allow that. Ask an admin or owner to do it.",
          interactionId: previousInteractionId,
          suggestedActions: [],
        };
      }

      return {
        text: pendingAction
          ? "I updated the pending action. Confirm it when it looks right, or keep describing changes."
          : "I can set that up. Please confirm before I make any changes.",
        interactionId: previousInteractionId,
        suggestedActions: [action],
      };
    }

    const configStatus = getChatbotConfigStatus();
    const model = configStatus.model;

    if (!configStatus.hasApiKey) {
      return {
        text: MISSING_API_KEY_MESSAGE,
        interactionId: previousInteractionId,
        model,
        suggestedActions: [],
        actions: [],
      };
    }

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
    return await runSuggestedAction(this.userId, action);
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
