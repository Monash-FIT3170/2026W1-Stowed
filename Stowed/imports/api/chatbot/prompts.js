export const SUGGESTED_PROMPTS = [
  "What should I stocktake today?",
  "Help me name storage locations.",
  "Make a low-stock checklist.",
  "Help",
];

export const PROMPT_GROUPS = [
  ["Stocktake and storage naming", SUGGESTED_PROMPTS.slice(0, 2)],
  [
    "Shopping lists",
    [
      "Make a low-stock checklist.",
      'Make a monthly low-stock checklist named "xxx".',
      'Create a shopping list named "xxx".',
      "Archive shopping lists.",
    ],
  ],
  [
    "Sites and floor maps",
    [
      'Create a site named "xxx".',
      "Create floor map — shows an example and available sites.",
      'Create a floor map named "xxx" in site "xxx".',
      'Create a shelf named "xxx" in floor map xxx with size 2 by 1 at 0, 0.',
      "Create a storage location named xxx in unit xxx.",
      'Move unit "xxx" at 2, 3.',
      "Resize unit xxx to 3 by 2.",
      'Assign 5 of "xxx" to unit xxx.',
      "Open unit xxx.",
      "Show low-stock floor map.",
      "Open floor map editor — use Save Layout to save canvas changes.",
    ],
  ],
  [
    "Products",
    [
      "Find products named xxx.",
      "Show low-stock products.",
      "Show details and storage locations for xxx.",
      "List storage locations.",
      "List product categories.",
      'Create a product named "xxx" with 10 units in xxx.',
      "Update xxx's low-stock threshold to 5.",
      "Delete product xxx.",
    ],
  ],
  [
    "Open a page",
    [
      "Open xxx.",
      "Open dashboard.",
      "Open inventory.",
      "Open lists.",
      "Open locations.",
      "Open floor map.",
      "Open QR codes.",
      "Open stocktake.",
      "Open scan.",
      "Open forecast.",
      "Open settings.",
      "Create account — opens account registration for owners.",
    ],
  ],
  [
    "Continue or cancel a task",
    [
      "Confirm — runs the proposed action after you review it.",
      'Change the name to "xxx" — revises a pending action.',
      "Cancel task — cancels a floor-map task while entering its details. Use Cancel on a confirmation card for other actions.",
      "Help — shows this prompt guide.",
    ],
  ],
];

export function getPromptHelp() {
  return [
    "Use these exact command templates. Replace each xxx with the relevant name or page before sending. For commands with multiple xxx placeholders, fill each one separately. Numbers shown are examples you can change. Actions depend on your account permissions; product tools need the AI connection.",
    ...PROMPT_GROUPS.map(
      ([title, prompts]) => `${title}\n${prompts.map((prompt) => `• ${prompt}`).join("\n")}`,
    ),
    "Review proposed changes before confirming. Asking for help does not create or change anything.",
  ].join("\n\n");
}
