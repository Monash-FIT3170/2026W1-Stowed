import { useMemo, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useNavigate } from "react-router-dom";
import { hasClientPermission } from "../../api/userMethods";
import { useAuth } from "../../api/useAuth";
import { DirectionsModal } from "./DirectionsModal";
import "./Chatbot.css";

const SUGGESTED_PROMPTS = [
  "What should I stocktake today?",
  "Help me name storage locations.",
  "Make a low-stock checklist.",
];
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
    return NAVIGATION_COMMANDS.find(
      (item) =>
        item.direct &&
        item.aliases.some((alias) => {
          const normalizedAlias = normalizeCommand(alias);
          return normalized === normalizedAlias || normalized.startsWith(`${normalizedAlias} `);
        }),
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

function ChoicePrompt({ choice, disabled, onSubmit }) {
  const [picked, setPicked] = useState([]);

  function toggle(value) {
    setPicked((current) =>
      choice.multiSelect
        ? current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value]
        : [value],
    );
  }

  return (
    <fieldset className="chatbot-choice" disabled={disabled}>
      <legend>{choice.prompt}</legend>
      {choice.options.map((option) => (
        <label className="chatbot-choice-option" key={option.value}>
          <input
            type={choice.multiSelect ? "checkbox" : "radio"}
            name={choice.id}
            checked={picked.includes(option.value)}
            onChange={() => toggle(option.value)}
          />
          <span>
            {option.label}
            {option.detail && <small>{option.detail}</small>}
          </span>
        </label>
      ))}
      <button type="button" disabled={picked.length === 0} onClick={() => onSubmit(choice, picked)}>
        {choice.multiSelect ? "Continue" : "Select"}
      </button>
    </fieldset>
  );
}

export function Chatbot() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi, I can help you manage your Stowed workspace.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [previousInteractionId, setPreviousInteractionId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [directionsRequest, setDirectionsRequest] = useState(null);
  const inputRef = useRef(null);

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

  function sendMessage(text = draft, selection = null) {
    const content = text.trim();
    if (!content || isSending) return;

    const nextMessages = [
      ...messages,
      { role: "user", content, ...(selection ? { selection } : {}) },
    ];
    setMessages(nextMessages);
    setDraft("");
    setError("");

    const navigationCommand = selection ? null : findNavigationCommand(content);
    if (navigationCommand) {
      if (
        navigationCommand.permission &&
        !hasClientPermission(role, navigationCommand.permission)
      ) {
        setPendingAction(null);
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
      {
        messages: nextMessages.map(({ role, content: text, actions, selection: picked }) => ({
          role,
          content: text,
          ...(actions ? { actions } : {}),
          ...(picked ? { selection: picked } : {}),
        })),
        previousInteractionId,
        pendingAction,
      },
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

        if (result?.openUrl && result?.url) {
          navigate(result.url);
        }

        // The server only returns paths the user's role is allowed to open.
        result?.actions?.forEach((action) => {
          if (action.type === "navigate" && action.path.startsWith("/")) navigate(action.path);
          if (action.type === "directions") setDirectionsRequest(action);
        });
        const choice = result?.actions?.find((action) => action.type === "choice") || null;

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: result?.text || "I could not generate a response this time.",
            actions: result?.suggestedActions || [],
            ...(choice ? { choice } : {}),
          },
        ]);
      },
    );
  }

  function submitChoice(choice, values) {
    const labels = choice.options
      .filter((option) => values.includes(option.value))
      .map((option) => option.label);
    sendMessage(labels.join(", "), { kind: choice.kind, values, context: choice.context });
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
    setPendingAction(null);
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
            <div>
              <h2>Chatbot</h2>
            </div>
            <button
              type="button"
              className="chatbot-close"
              aria-label="Close chatbot"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="chatbot-messages">
            {visibleMessages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`chatbot-message ${message.role}`}
              >
                <div className="chatbot-label">
                  {message.role === "assistant" ? "Chatbot" : "You"}
                </div>
                {message.content && <div className="chatbot-body">{message.content}</div>}
                {message.choice && (
                  <ChoicePrompt
                    key={message.choice.id}
                    choice={message.choice}
                    disabled={isSending || message !== visibleMessages.at(-1)}
                    onSubmit={submitChoice}
                  />
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

          {messages.length === 1 && (
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

      {directionsRequest && (
        <DirectionsModal request={directionsRequest} onClose={() => setDirectionsRequest(null)} />
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
