import { BUDGET_STRATEGIES } from "../shoppingLists/constants";
import { GENERATION_MODES } from "../schedules/constants";

export const SCHEDULE_SEEDS = [
  {
    name: "Weekly Lab Safety Restock",
    frequency: "weekly",
    generationMode: GENERATION_MODES.EXPLICIT,
    items: [
      { productName: "Lab Safety Goggles", quantityWanted: 10 },
      { productName: "Nitrile Gloves (Box of 100)", quantityWanted: 5 },
    ],
  },

  {
    name: "Weekly IT Consumables Auto-Restock",
    frequency: "weekly",
    generationMode: GENERATION_MODES.AUTO,
    autoConfig: {
      strategy: BUDGET_STRATEGIES.MAX_PRODUCTS,
    },
  },
];
