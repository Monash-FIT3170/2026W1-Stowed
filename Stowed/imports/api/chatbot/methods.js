import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { requirePermission } from "../userMethods";

const MAX_MESSAGES = 8;
const MAX_STATEFUL_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 1000;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_MAX_OUTPUT_TOKENS = 256;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_ERROR_MESSAGE = "Sorry, we cannot help with that right now.";
const SYSTEM_INSTRUCTION = [
  "You are Stowed's inventory assistant.",
  "Help with inventory, stocktakes, locations, shopping lists, QR codes, storage units, and related workflows.",
  "Keep answers concise and practical.",
  "If the user asks for something outside Stowed's inventory scope, briefly say you can only help with Stowed inventory tasks.",
].join(" ");

let aiClient = null;
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

async function createChatbotResponse({ ai, model, contents }) {
  return await ai.models.generateContent({
    model,
    contents,
    config: {
      maxOutputTokens: getNumberSetting("GEMINI_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS),
      temperature: getNumberSetting("GEMINI_TEMPERATURE", DEFAULT_TEMPERATURE),
      systemInstruction: SYSTEM_INSTRUCTION,
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

    try {
      const ai = getAiClient();
      const contents =
        messages.length <= MAX_STATEFUL_MESSAGES
          ? toGeminiContents(messages)
          : [{ role: "user", parts: [{ text: input }] }];
      const response = await createChatbotResponse({ ai, model, contents });

      return {
        text: response.text || "I could not generate a response this time.",
        interactionId: response.responseId,
        model,
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
