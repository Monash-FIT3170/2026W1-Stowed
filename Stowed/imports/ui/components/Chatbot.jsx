import { useMemo, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import "./Chatbot.css";

const SUGGESTED_PROMPTS = [
  "What should I stocktake today?",
  "Help me name storage locations.",
  "Make a low-stock checklist.",
];

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi, I can help with inventory, stocktakes, locations, lists, and QR codes.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const canSend = draft.trim().length > 0 && !isSending;

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.content.trim().length > 0),
    [messages],
  );

  function openChat() {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function sendMessage(text = draft) {
    const content = text.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setIsSending(true);

    Meteor.call("chatbot.chat", { messages: nextMessages }, (callError, result) => {
      setIsSending(false);

      if (callError) {
        setError(callError.reason || callError.message || "The chatbot could not respond.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result?.text || "I could not generate a response this time.",
        },
      ]);
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
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
              <span>Inventory help</span>
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
              <article key={`${message.role}-${index}`} className={`chatbot-message ${message.role}`}>
                <div className="chatbot-label">
                  {message.role === "assistant" ? "Chatbot" : "You"}
                </div>
                <div className="chatbot-body">{message.content}</div>
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
