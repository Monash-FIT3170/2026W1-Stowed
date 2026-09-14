import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { GoogleGenAI } from "@google/genai";
import { requirePermission } from "../userMethods";

const MAX_MESSAGES = 8;
const MAX_STATEFUL_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 1000;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_MAX_OUTPUT_TOKENS = 256;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_ERROR_MESSAGE = "Sorry, we cannot help with that right now.";
const INVALID_JSON_OUTPUT_MESSAGE =
  "Model generated invalid JSON syntax and the output could not be parsed.";

let aiClient = null;

function getSetting(name) {
  return process.env[name] || Meteor.settings?.[name] || Meteor.settings?.private?.[name];
}

function getNumberSetting(name, fallback) {
  const value = Number(getSetting(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getAiClient() {
  const apiKey = getSetting("GEMINI_API_KEY") || getSetting("GOOGLE_API_KEY");
  if (!apiKey) {
    throw new Meteor.Error("gemini-not-configured", DEFAULT_ERROR_MESSAGE);
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
}

function getLatestUserInput(messages) {
  const latestUserMessage = messages
    .slice(-MAX_MESSAGES)
    .reverse()
    .find((message) => message.role === "user" && message.content.trim().length > 0);

  return latestUserMessage?.content.trim().slice(0, MAX_MESSAGE_LENGTH) || "";
}

function isInvalidJsonOutputError(error) {
  return String(error?.message || error?.reason || "").includes(INVALID_JSON_OUTPUT_MESSAGE);
}

async function createChatbotInteraction({ ai, model, input, previousInteractionId }) {
  return await ai.interactions.create({
    model,
    input,
    generation_config: {
      max_output_tokens: getNumberSetting("GEMINI_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS),
      temperature: getNumberSetting("GEMINI_TEMPERATURE", DEFAULT_TEMPERATURE),
    },
    ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
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
    const activePreviousInteractionId =
      messages.length <= MAX_STATEFUL_MESSAGES ? previousInteractionId : null;
    const ai = getAiClient();

    try {
      let interaction;

      try {
        interaction = await createChatbotInteraction({
          ai,
          model,
          input,
          previousInteractionId: activePreviousInteractionId,
        });
      } catch (error) {
        if (!isInvalidJsonOutputError(error)) throw error;

        interaction = await createChatbotInteraction({
          ai,
          model,
          input: `${INVALID_JSON_OUTPUT_MESSAGE} Please retry the request and ensure any required structured output is valid JSON. Return the final answer as plain text.\n\nUser request: ${input}`,
          previousInteractionId: activePreviousInteractionId,
        });
      }

      return {
        text: interaction.output_text || "I could not generate a response this time.",
        interactionId: interaction.id,
        model,
      };
    } catch (error) {
      console.error("chatbot.chat failed:", error);
      throw new Meteor.Error("gemini-request-failed", DEFAULT_ERROR_MESSAGE);
    }
  },
});
