import { LIST_ORIGINS, LIST_STATUSES, ADD_PRODUCT_MODES } from "../shoppingLists/constants";

export const SHOPPING_LIST_SEEDS = [
  {
    name: "Weekly IT Accessories Restock",
    origin: LIST_ORIGINS.MANUAL,
    status: LIST_STATUSES.DRAFT,
    createdDaysAgo: 1,
    updatedDaysAgo: 1,
    items: [
      { productName: "Wireless Mouse", quantityWanted: 10, addMode: ADD_PRODUCT_MODES.GENERATED },
      {
        productName: "USB Hub (4-Port)",
        quantityWanted: 8,
        addMode: ADD_PRODUCT_MODES.GENERATED,
      },
      { productName: "Webcam (1080p)", quantityWanted: 5, addMode: ADD_PRODUCT_MODES.MANUAL },
    ],
  },

  {
    name: "Science Storeroom Restock – Week 34",
    origin: LIST_ORIGINS.MANUAL,
    status: LIST_STATUSES.SAVED,
    createdDaysAgo: 6,
    updatedDaysAgo: 2,
    items: [
      {
        productName: "Lab Safety Goggles",
        quantityWanted: 20,
        addMode: ADD_PRODUCT_MODES.GENERATED,
        purchased: true,
        received: true,
        allocatedLocationName: "Cabinet A - Shelf 1",
        allocatedDaysAgo: 2,
      },
      {
        productName: "Nitrile Gloves (Box of 100)",
        quantityWanted: 15,
        addMode: ADD_PRODUCT_MODES.GENERATED,
        purchased: true,
        received: false,
      },
      {
        productName: "Safety Glasses (Clear, Anti-Fog)",
        quantityWanted: 10,
        addMode: ADD_PRODUCT_MODES.MANUAL,
      },
    ],
  },

  {
    name: "End of Semester Cleaning Restock",
    origin: LIST_ORIGINS.MANUAL,
    status: LIST_STATUSES.ARCHIVED,
    createdDaysAgo: 28,
    updatedDaysAgo: 20,
    archivedDaysAgo: 20,
    archivedWithPendingItems: false,
    items: [
      {
        productName: "Paper Towels (Pack of 16 Rolls)",
        quantityWanted: 12,
        purchased: true,
        received: true,
      },
      {
        productName: "Disinfectant Spray (750mL)",
        quantityWanted: 20,
        purchased: true,
        received: true,
      },
      {
        productName: "Garbage Bags (Heavy Duty, 50pk)",
        quantityWanted: 10,
        purchased: true,
        received: true,
      },
    ],
  },
];
