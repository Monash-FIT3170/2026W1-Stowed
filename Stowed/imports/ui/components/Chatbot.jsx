import { useEffect, useMemo, useRef, useState } from "react";
import { Random } from "meteor/random";
import { Meteor } from "meteor/meteor";
import { useNavigate } from "react-router-dom";
import { hasClientPermission } from "../../api/userMethods";
import { useAuth } from "../../api/useAuth";
import { SUGGESTED_PROMPTS, getPromptHelp } from "../../api/chatbot/prompts";
import { ChatbotPromptExamples } from "./ChatbotPromptExamples";
import "./Chatbot.css";

const DEFAULT_ERROR_MESSAGE = "Sorry, we cannot help with that right now.";
const NAVIGATION_COMMANDS = [
  {
    route: "/qr-codes",
    label: "QR Codes",
    aliases: ["qr code", "qr codes", "qrcode", "qrcodes", "barcode", "barcodes"],
  },
  {
    route: "/inventory",
    label: "Inventory",
    aliases: ["inventory", "products", "product list"],
  },
  {
    route: "/lists",
    label: "Lists",
    aliases: ["list", "lists", "shopping list", "shopping lists"],
  },
  {
    route: "/locations",
    label: "Locations",
    aliases: ["location", "locations", "storage location", "storage locations"],
  },
  {
    route: "/floor-map",
    label: "Floor Map",
    aliases: ["floor map", "floormap", "map"],
  },
  {
    route: "/dashboard",
    label: "Dashboard",
    aliases: ["dashboard", "home"],
  },
  {
    route: "/alerts",
    label: "Stocktake",
    aliases: ["alert", "alerts", "stocktake", "stock take"],
  },
  {
    route: "/scan",
    label: "Scan",
    aliases: ["scan", "scanner"],
  },
  {
    route: "/settings",
    label: "Settings",
    aliases: ["settings", "setting"],
  },
  {
    route: "/register",
    label: "Create Account",
    aliases: [
      "create account",
      "create an account",
      "add account",
      "new account",
      "add user",
      "new user",
      "add team member",
      "create team member",
    ],
    direct: true,
    permission: "create-users",
  },
];

const NAVIGATION_VERBS = [
  "open",
  "go to",
  "goto",
  "show",
  "take me to",
  "navigate to",
  "redirect to",
  "bring me to",
];
const FLOOR_MAP_ACTION_HINTS =
  /\b(low\s*stock|low-stock|highlight|editor|edit|save layout|save changes|layout changes)\b/i;

function normalizeCommand(input) {
  return input
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findNavigationCommand(input) {
  const normalized = normalizeCommand(input)
    .replace(/\bthe\b/g, "")
    .replace(/\bpage\b/g, "")
    .replace(/\bhub\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const hasNavigationVerb = NAVIGATION_VERBS.some(
    (verb) => normalized === verb || normalized.startsWith(`${verb} `),
  );
  if (!hasNavigationVerb) {
    // Only a bare shortcut like "add user" jumps straight to the page. Anything
    // with details after it ("add user tim, tim@x.com") goes to the chatbot so
    // it can create the account for the user.
    return NAVIGATION_COMMANDS.find(
      (item) => item.direct && item.aliases.some((alias) => normalized === normalizeCommand(alias)),
    );
  }

  const command = NAVIGATION_COMMANDS.find((item) =>
    item.aliases.some((alias) => {
      const normalizedAlias = normalizeCommand(alias);
      return (
        normalized === normalizedAlias ||
        normalized.endsWith(` ${normalizedAlias}`) ||
        normalized.includes(` ${normalizedAlias} `)
      );
    }),
  );
  if (command?.route === "/floor-map" && FLOOR_MAP_ACTION_HINTS.test(input)) return null;
  return command;
}

const INITIAL_MESSAGES = [
  { role: "assistant", content: "Hi, I can help you manage your Stowed workspace." },
];

export function Chatbot() {
  const { user } = useAuth();
  return <ChatbotSession key={`${user?._id}:${user?.profile?.organisationId}`} />;
}

function ChatbotSession() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [conversationId, setConversationId] = useState(() => Random.id());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saveAttempt, setSaveAttempt] = useState(0);
  const saveQueue = useRef(Promise.resolve());
  const savedSnapshot = useRef("");
  const saveRevision = useRef(0);
  const messagesRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [previousInteractionId, setPreviousInteractionId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isSending || messages.length < 2) return;
    const snapshot = { conversationId, messages, previousInteractionId, pendingAction, activeTask };
    const serialized = JSON.stringify(snapshot);
    if (savedSnapshot.current === serialized) return;
    const revision = ++saveRevision.current;
    setSaveStatus("saving");
    saveQueue.current = saveQueue.current
      .then(() => Meteor.callAsync("chatbot.history.save", snapshot))
      .then(() => {
        if (saveRevision.current === revision) {
          savedSnapshot.current = serialized;
          setSaveStatus("saved");
        }
      })
      .catch(() => {
        if (saveRevision.current === revision) setSaveStatus("error");
      });
  }, [
    conversationId,
    messages,
    previousInteractionId,
    pendingAction,
    activeTask,
    isSending,
    saveAttempt,
  ]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isSending, isOpen, historyOpen]);

  async function showHistory(loadMore = false) {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      await saveQueue.current;
      const entries = await Meteor.callAsync("chatbot.history.list", {
        skip: loadMore ? history.length : 0,
      });
      setHistory((current) => (loadMore ? [...current, ...entries] : entries));
      setHasMoreHistory(entries.length === 100);
    } catch {
      setHistoryError("Could not load chat history. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadConversation(id) {
    if (isSending || historyLoading || saveStatus === "saving" || saveStatus === "error") return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      await saveQueue.current;
      const conversation = await Meteor.callAsync("chatbot.history.get", id);
      const snapshot = {
        conversationId: conversation._id,
        messages: conversation.messages,
        previousInteractionId: conversation.previousInteractionId,
        pendingAction: conversation.pendingAction,
        activeTask: conversation.activeTask || null,
      };
      savedSnapshot.current = JSON.stringify(snapshot);
      setConversationId(snapshot.conversationId);
      setMessages(snapshot.messages);
      setPreviousInteractionId(snapshot.previousInteractionId);
      setPendingAction(snapshot.pendingAction);
      setActiveTask(snapshot.activeTask);
      setSaveStatus("saved");
      setDraft("");
      setError("");
      setHistoryOpen(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch {
      setHistoryError("Could not open this conversation. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewChat() {
    if (isSending || historyLoading || saveStatus === "saving" || saveStatus === "error") return;
    saveRevision.current += 1;
    savedSnapshot.current = "";
    setConversationId(Random.id());
    setMessages(INITIAL_MESSAGES);
    setPreviousInteractionId(null);
    setPendingAction(null);
    setActiveTask(null);
    setDraft("");
    setError("");
    setSaveStatus("");
    setHistoryOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const canSend = draft.trim().length > 0 && !isSending;

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) => message.content.trim().length > 0 || message.actions?.length > 0,
      ),
    [messages],
  );

  function openChat() {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function sendMessage(text = draft) {
    const content = text.trim();
    if (!content || isSending) return;
    if (
      activeTask &&
      !pendingAction &&
      /^(?:cancel(?: task)?|never\s*mind|stop)[.!?]*$/i.test(content)
    ) {
      cancelAction({ title: "Create floor map" });
      setDraft("");
      return;
    }

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setError("");

    const navigationCommand = findNavigationCommand(content);
    if (navigationCommand) {
      if (
        navigationCommand.permission &&
        !hasClientPermission(role, navigationCommand.permission)
      ) {
        setPendingAction(null);
        setActiveTask(null);
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: "Only an owner can create accounts for this organisation.",
          },
        ]);
        inputRef.current?.focus();
        return;
      }
      navigate(navigationCommand.route);
      setPendingAction(null);
      setActiveTask(null);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `Opened ${navigationCommand.label}.`,
        },
      ]);
      inputRef.current?.focus();
      return;
    }

    setIsSending(true);

    Meteor.call(
      "chatbot.chat",
      { messages: nextMessages, previousInteractionId, pendingAction },
      (callError, result) => {
        setIsSending(false);

        if (callError) {
          console.error("chatbot.chat failed:", callError);
          setError(
            Meteor.isDevelopment
              ? callError.reason || DEFAULT_ERROR_MESSAGE
              : DEFAULT_ERROR_MESSAGE,
          );
          return;
        }

        if (result?.interactionId) {
          setPreviousInteractionId(result.interactionId);
        }

        const nextAction = result?.suggestedActions?.[0] || null;
        setPendingAction(nextAction);
        setActiveTask(
          (current) =>
            result?.activeTask ||
            (nextAction || result?.openUrl || result?.actions?.length ? null : current),
        );

        if (result?.openUrl && result?.url) {
          navigate(result.url);
        }

        // The server only returns paths the user's role is allowed to open.
        result?.actions?.forEach((action) => {
          if (action.type === "navigate" && action.path.startsWith("/")) navigate(action.path);
        });

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: result?.text || "I could not generate a response this time.",
            actions: result?.suggestedActions || [],
          },
        ]);
      },
    );
  }

  function confirmAction(action) {
    if (isSending) return;

    setError("");
    setIsSending(true);
    setMessages((current) => [...current, { role: "user", content: `Confirm: ${action.summary}` }]);

    Meteor.call("chatbot.confirmAction", { action }, (callError, result) => {
      setIsSending(false);

      if (callError) {
        console.error("chatbot.confirmAction failed:", callError);
        setError(
          Meteor.isDevelopment ? callError.reason || DEFAULT_ERROR_MESSAGE : DEFAULT_ERROR_MESSAGE,
        );
        return;
      }

      setPendingAction(null);
      setActiveTask(null);
      if (result?.openUrl && result?.url) {
        navigate(result.url);
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            result?.url && !result?.openUrl
              ? `${result.text}\nOpen it from Lists: ${result.url}`
              : result.text,
        },
      ]);
    });
  }

  function cancelAction(action) {
    setError("");
    setPendingAction(null);
    setActiveTask(null);
    setMessages((current) => [
      ...current,
      { role: "user", content: `Cancel: ${action.title}` },
      { role: "assistant", content: "Cancelled. Nothing was changed." },
    ]);
    inputRef.current?.focus();
  }

  function changeAction(action) {
    setDraft(`Change ${action.title.toLowerCase()} to `);
    inputRef.current?.focus();
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handlePromptClick(prompt) {
    sendMessage(prompt);
    inputRef.current?.focus();
  }

  return (
    <div className={`chatbot${isOpen ? " open" : ""}`}>
      {isOpen && (
        <section className="chatbot-panel" aria-label="Chatbot">
          <header className="chatbot-header">
            <button
              type="button"
              className="chatbot-history-toggle"
              aria-label={historyOpen ? "Back to chat" : "Open chat history"}
              aria-expanded={historyOpen}
              aria-controls="chatbot-history"
              disabled={isSending}
              onClick={() => (historyOpen ? setHistoryOpen(false) : showHistory())}
            >
              {historyOpen ? "←" : "☰"}
            </button>
            <h2>{historyOpen ? "Chat history" : "Chatbot"}</h2>
            <button
              type="button"
              className="chatbot-close"
              aria-label="Close chatbot"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="chatbot-workspace">
            <aside
              id="chatbot-history"
              className={`chatbot-history${historyOpen ? " visible" : ""}`}
              aria-label="Chat history"
              aria-hidden={!historyOpen}
              inert={historyOpen ? undefined : ""}
            >
              <div className="chatbot-history-toolbar">
                <button type="button" onClick={() => setHistoryOpen(false)}>
                  ← Back to chat
                </button>
                <button
                  type="button"
                  disabled={
                    isSending || historyLoading || saveStatus === "saving" || saveStatus === "error"
                  }
                  onClick={startNewChat}
                >
                  + New chat
                </button>
              </div>
              <p className="chatbot-history-intro">Your conversations, saved to your account.</p>
              {isSending && (
                <p className="chatbot-history-intro" role="status">
                  Wait for the current response before switching chats.
                </p>
              )}
              {saveStatus === "error" && (
                <div className="chatbot-error" role="alert">
                  Your current conversation could not be saved. Go back to chat and retry saving
                  before switching conversations.
                </div>
              )}
              {historyLoading && (
                <p className="chatbot-history-intro" role="status">
                  Loading history...
                </p>
              )}
              {historyError && (
                <div className="chatbot-error" role="alert">
                  {historyError}{" "}
                  <button type="button" onClick={() => showHistory()}>
                    Try again
                  </button>
                </div>
              )}
              {!historyLoading && !historyError && history.length === 0 && (
                <p className="chatbot-history-intro">
                  No saved conversations yet. Start a chat to see it here.
                </p>
              )}
              <nav className="chatbot-history-list" aria-label="Saved conversations">
                {history.map((conversation) => (
                  <button
                    type="button"
                    key={conversation._id}
                    aria-current={conversation._id === conversationId ? "true" : undefined}
                    disabled={
                      isSending ||
                      historyLoading ||
                      saveStatus === "saving" ||
                      saveStatus === "error"
                    }
                    onClick={() => loadConversation(conversation._id)}
                  >
                    <strong>{conversation.title || "Untitled conversation"}</strong>
                    <time dateTime={new Date(conversation.updatedAt).toISOString()}>
                      {new Date(conversation.updatedAt).toLocaleString()}
                    </time>
                  </button>
                ))}
                {hasMoreHistory && (
                  <button type="button" disabled={historyLoading} onClick={() => showHistory(true)}>
                    Load older conversations
                  </button>
                )}
              </nav>
            </aside>
            <div
              className="chatbot-chat"
              aria-hidden={historyOpen}
              inert={historyOpen ? "" : undefined}
            >
              <div className="chatbot-messages" ref={messagesRef}>
                {visibleMessages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={`chatbot-message ${message.role}`}
                  >
                    <div className="chatbot-label">
                      {message.role === "assistant" ? "Chatbot" : "You"}
                    </div>
                    {message.role === "assistant" && message.content === getPromptHelp() ? (
                      <ChatbotPromptExamples
                        disabled={isSending}
                        onSelect={(prompt) => {
                          setDraft(prompt);
                          inputRef.current?.focus();
                        }}
                      />
                    ) : (
                      message.content && <div className="chatbot-body">{message.content}</div>
                    )}
                    {message.actions?.length > 0 && (
                      <div className="chatbot-actions">
                        {message.actions.map((action) => (
                          <div className="chatbot-action-card" key={action.id}>
                            <div className="chatbot-action-title">{action.title}</div>
                            <div className="chatbot-action-summary">{action.summary}</div>
                            <div className="chatbot-action-buttons">
                              <button
                                type="button"
                                disabled={isSending || pendingAction?.id !== action.id}
                                onClick={() => confirmAction(action)}
                              >
                                {action.confirmLabel || "Confirm"}
                              </button>
                              <button
                                type="button"
                                disabled={isSending || pendingAction?.id !== action.id}
                                onClick={() => changeAction(action)}
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                disabled={isSending || pendingAction?.id !== action.id}
                                onClick={() => cancelAction(action)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {isSending && (
                  <article className="chatbot-message assistant pending">
                    <div className="chatbot-label">Chatbot</div>
                    <div className="chatbot-body">Thinking...</div>
                  </article>
                )}
              </div>

              {!isSending && !pendingAction && !activeTask && (
                <div className="chatbot-prompts">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isSending}
                      onClick={() => handlePromptClick(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {activeTask === "createFloorMap" && !pendingAction && (
                <div className="chatbot-task-status">
                  <span>Creating a floor map — waiting for your map name and site.</span>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => cancelAction({ title: "Create floor map" })}
                  >
                    Cancel task
                  </button>
                </div>
              )}

              {error && (
                <div className="chatbot-error" role="alert">
                  {error}
                </div>
              )}
              {saveStatus && (
                <div className={`chatbot-save-status ${saveStatus}`} role="status">
                  {saveStatus === "saving" && "Saving conversation..."}
                  {saveStatus === "saved" && "Saved to history"}
                  {saveStatus === "error" && (
                    <>
                      Could not save this conversation.{" "}
                      <button type="button" onClick={() => setSaveAttempt((value) => value + 1)}>
                        Retry save
                      </button>
                    </>
                  )}
                </div>
              )}

              <form className="chatbot-composer" onSubmit={handleSubmit}>
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask Stowed..."
                  rows={2}
                />
                <button type="submit" disabled={!canSend} aria-label="Send message">
                  Send
                </button>
              </form>
            </div>
          </div>
          )}

          {error && <div className="chatbot-error">{error}</div>}

          <form className="chatbot-composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask Stowed..."
              rows={2}
            />
            <button type="submit" disabled={!canSend} aria-label="Send message">
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chatbot-launcher"
        aria-label={isOpen ? "Chatbot open" : "Open chatbot"}
        onClick={isOpen ? () => setIsOpen(false) : openChat}
      >
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      </button>
    </div>
  );
}
