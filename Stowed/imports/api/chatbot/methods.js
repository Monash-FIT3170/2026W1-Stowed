import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { requirePermission, hasPermission } from "../userMethods";
import { buildToolDeclarations, executeTool, TOOL_PERMISSIONS } from "./tools";

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_TOOL_ROUNDS = 5;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_MAX_OUTPUT_TOKENS = 256;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_ERROR_MESSAGE = "Sorry, we cannot help with that right now.";
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
  async "chatbot.chat"({ messages, previousInteractionId }) {
    check(messages, [
      {
        role: Match.Where((value) => value === "user" || value === "assistant"),
        content: String,
      },
    ]);
    check(previousInteractionId, Match.Maybe(String));

    await requirePermission(this.userId, "chatbot.chat");

    const input = getLatestUserInput(messages);
    if (!input) {
      throw new Meteor.Error("empty-message", "Ask something first.");
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
