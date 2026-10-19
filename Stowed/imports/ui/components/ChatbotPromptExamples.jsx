import { PROMPT_GROUPS } from "../../api/chatbot/prompts";

export function ChatbotPromptExamples({ onSelect, disabled = false }) {
  return (
    <div className="chatbot-prompt-guide">
      <p>
        Choose a command to fill the chat box. Replace each xxx with the name or page you want
        before sending.
      </p>
      <p>
        Fill each xxx separately, using existing names when referring to a site, map, unit,
        location, or product. Change example numbers as needed.
      </p>
      {PROMPT_GROUPS.map(([title, prompts], index) => (
        <details key={title} open={index === 0}>
          <summary>{title}</summary>
          <div className="chatbot-prompt-examples">
            {prompts.map((example) => {
              const [prompt, description] = example.split(" — ");
              return (
                <div key={example}>
                  <button type="button" disabled={disabled} onClick={() => onSelect(prompt)}>
                    {prompt}
                  </button>
                  {description && <small>{description}</small>}
                </div>
              );
            })}
          </div>
        </details>
      ))}
      <p>Review proposed changes before confirming.</p>
    </div>
  );
}
