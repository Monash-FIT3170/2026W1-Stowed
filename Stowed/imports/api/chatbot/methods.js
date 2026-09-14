import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { GoogleGenAI } from "@google/genai";
import { requirePermission } from "../userMethods";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_MODEL = "gemini-3.8-flash";

let aiClient = null;

function getSetting(name) {
  return process.env[name] || Meteor.settings?.[name] || Meteor.settings?.private?.[name];
}

function getAiClient() {
  const apiKey = getSetting("GEMINI_API_KEY") || getSetting("GOOGLE_API_KEY");
  if (!apiKey) {
    throw new Meteor.Error(
      "gemini-not-configured",
      "Gemini is not configured. Set GEMINI_API_KEY in the server environment or Meteor settings.",
    );
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
    const ai = getAiClient();

    try {
      const interaction = await ai.interactions.create({
        model,
        input,
        ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
      });

      return {
        text: interaction.output_text || "I could not generate a response this time.",
        interactionId: interaction.id,
        model,
      };
    } catch (error) {
      console.error("chatbot.chat failed:", error);
      throw new Meteor.Error(
        "gemini-request-failed",
        error?.message || "Gemini could not answer right now.",
      );
    }
  },
});
