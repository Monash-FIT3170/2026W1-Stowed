import { Meteor } from "meteor/meteor";
import { Mongo } from "meteor/mongo";
import { check, Match } from "meteor/check";
import { getCallerOrgId, requirePermission } from "../userMethods";

// Imported only by the server: conversation records are never published globally.
export const ChatConversations = new Mongo.Collection("chatConversations");

async function historyScope(userId) {
  await requirePermission(userId, "chatbot.chat");
  const orgId = await getCallerOrgId(userId);
  if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");
  return { userId, orgId };
}

Meteor.startup(async () => {
  await ChatConversations.rawCollection().createIndex({ userId: 1, orgId: 1, updatedAt: -1 });
});

Meteor.methods({
  async "chatbot.history.save"({
    conversationId,
    messages,
    previousInteractionId,
    pendingAction,
    activeTask,
  }) {
    const scope = await historyScope(this.userId);
    check(conversationId, String);
    check(messages, [
      {
        role: Match.OneOf("user", "assistant"),
        content: String,
        actions: Match.Optional([Object]),
      },
    ]);
    check(previousInteractionId, Match.Maybe(String));
    check(pendingAction, Match.Maybe(Object));
    check(activeTask, Match.Maybe(Match.OneOf("createFloorMap")));
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(conversationId) ||
      messages.length > 1000 ||
      !messages.some((message) => message.role === "user") ||
      JSON.stringify({ messages, pendingAction }).length > 1000000
    ) {
      throw new Meteor.Error("invalid-history", "This conversation cannot be saved.");
    }
    const existing = await ChatConversations.findOneAsync(conversationId);
    if (existing && (existing.userId !== scope.userId || existing.orgId !== scope.orgId)) {
      throw new Meteor.Error("not-found", "Conversation not found.");
    }
    const now = new Date();
    await ChatConversations.upsertAsync(
      { _id: conversationId, ...scope },
      {
        $set: {
          title: messages
            .find((message) => message.role === "user")
            .content.trim()
            .slice(0, 100),
          messages,
          previousInteractionId: previousInteractionId || null,
          pendingAction: pendingAction || null,
          activeTask: activeTask || null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
    );
    return conversationId;
  },

  async "chatbot.history.list"({ skip = 0 } = {}) {
    check(skip, Match.Integer);
    if (skip < 0) throw new Meteor.Error("invalid-page", "Invalid history page.");
    const scope = await historyScope(this.userId);
    return ChatConversations.find(scope, {
      fields: { title: 1, createdAt: 1, updatedAt: 1 },
      sort: { updatedAt: -1, _id: 1 },
      skip,
      limit: 100,
    }).fetchAsync();
  },

  async "chatbot.history.get"(conversationId) {
    check(conversationId, String);
    const scope = await historyScope(this.userId);
    const conversation = await ChatConversations.findOneAsync({ _id: conversationId, ...scope });
    if (!conversation) throw new Meteor.Error("not-found", "Conversation not found.");
    return conversation;
  },
});
