import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { GoogleGenAI } from "@google/genai";
import { requirePermission, hasPermission } from "../userMethods";
import { buildToolDeclarations, executeTool, TOOL_PERMISSIONS } from "./tools";

const MAX_MESSAGES = 8;
const MAX_STATEFUL_MESSAGES = 6;
const MAX_CONTEXT_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 1000;
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_MAX_OUTPUT_TOKENS = 256;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_ERROR_MESSAGE = "Sorry, we cannot help with that right now.";
const INVALID_JSON_OUTPUT_MESSAGE =
  "Model generated invalid JSON syntax and the output could not be parsed.";

const MAX_TOOL_ROUNDS = 5;
const SYSTEM_INSTRUCTION = [
  "You are the assistant inside Stowed, an inventory app for shops and storerooms.",
  "Use the tools to look things up and to act for the user; never invent product or location ids.",
  "You can only use the tools you are given - they match the user's role. If asked for something outside them, say you can't do that with their account.",
  "Before creating, editing or deleting a product, tell the user exactly what will change and end your message with: Reply CONFIRM to proceed. Do not run the change yet.",
  "If the user's next message is CONFIRM (any capitalisation, or a plain yes), call the same tool again with exactly the same arguments plus confirmed true - do not ask again. Any other reply cancels the change.",
  "When asked to take the user somewhere, use the navigate tool. Keep replies short.",
].join(" ");

let aiClient = null;
let chatTurn = 0;

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

// When the server-side chain is dropped (long chats), a bare "CONFIRM" would reach
// the model with nothing to confirm - so replay the last few messages as text.
function withRecentContext(messages, input) {
  const earlier = messages.slice(0, -1).slice(-MAX_CONTEXT_MESSAGES);
  if (earlier.length === 0) return input;

  const transcript = earlier
    .map((message) => {
      const speaker = message.role === "user" ? "User" : "Assistant";
      return `${speaker}: ${message.content.trim().slice(0, 500)}`;
    })
    .join("\n");
  return `Recent conversation:\n${transcript}\n\nLatest user message: ${input}`;
}

function isInvalidJsonOutputError(error) {
  return String(error?.message || error?.reason || "").includes(INVALID_JSON_OUTPUT_MESSAGE);
}

async function createChatbotInteraction({ ai, model, input, previousInteractionId, tools }) {
  return await ai.interactions.create({
    model,
    input,
    system_instruction: SYSTEM_INSTRUCTION,
    ...(tools?.length ? { tools } : {}),
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
    const modelInput = activePreviousInteractionId ? input : withRecentContext(messages, input);

    const userId = this.userId;
    const permissionNames = new Set();
    for (const permission of TOOL_PERMISSIONS) {
      if (await hasPermission(userId, permission)) permissionNames.add(permission);
    }
    const tools = buildToolDeclarations((permission) => permissionNames.has(permission));
    const allowedToolNames = new Set(tools.map((tool) => tool.name));
    const actions = [];
    const turn = ++chatTurn;

    try {
      let interaction;

      try {
        interaction = await createChatbotInteraction({
          ai,
          model,
          input: modelInput,
          previousInteractionId: activePreviousInteractionId,
          tools,
        });
      } catch (error) {
        if (!isInvalidJsonOutputError(error)) throw error;

        interaction = await createChatbotInteraction({
          ai,
          model,
          input: `${INVALID_JSON_OUTPUT_MESSAGE} Please retry the request and ensure any required structured output is valid JSON. Return the final answer as plain text.\n\nUser request: ${input}`,
          previousInteractionId: activePreviousInteractionId,
          tools,
        });
      }

      // Run any tool calls the model asks for, as this user, and feed results back.
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const calls = (interaction.steps || []).filter((step) => step.type === "function_call");
        if (calls.length === 0) break;

        const results = [];
        for (const call of calls) {
          const result = await executeTool({
            userId,
            toolName: call.name,
            args: call.arguments,
            turn,
            allowedToolNames,
            actions,
          });
          results.push({
            type: "function_result",
            call_id: call.id,
            name: call.name,
            result: JSON.stringify(result),
          });
        }

        interaction = await createChatbotInteraction({
          ai,
          model,
          input: results,
          previousInteractionId: interaction.id,
          tools,
        });
      }

      return {
        text: interaction.output_text || "I could not generate a response this time.",
        interactionId: interaction.id,
        model,
        actions,
      };
    } catch (error) {
      console.error("chatbot.chat failed:", error);
      throw new Meteor.Error("gemini-request-failed", DEFAULT_ERROR_MESSAGE);
    }
  },
});
