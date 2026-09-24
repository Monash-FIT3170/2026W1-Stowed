export const SIDEBAR_TOUR_STEPS = [
  {
    to: "/dashboard",
    title: "Dashboard",
    body: "Your home base: stock levels, alerts and recent activity at a glance.",
  },
  {
    to: "/locations",
    title: "Locations",
    body: "Set up the places you store things, like rooms, sheds and storage units.",
  },
  {
    to: "/floor-map",
    title: "Floor Map",
    body: "Draw a layout of your space and see where each storage unit sits.",
  },
  {
    to: "/inventory",
    title: "Inventory",
    body: "Every product you track. Add, edit and adjust stock from here.",
  },
  {
    to: "/lists",
    title: "Lists",
    body: "Build shopping lists from products that are running low.",
  },
  {
    to: "/scan",
    title: "Scan",
    body: "Scan a barcode or QR code to jump straight to a product or location.",
  },
  {
    to: "/qr-codes",
    title: "QR Codes",
    body: "Generate and print QR labels for your locations and products.",
  },
  {
    to: "/alerts",
    title: "Stocktake",
    body: "See stock alerts and run stocktakes to keep your counts accurate.",
  },
  {
    to: "/settings",
    title: "Settings",
    body: "Manage your preferences and import or export your data.",
  },
];

/* One-off intro modal shown the first time a user opens each sidebar page. */
export const PAGE_INTROS = {
  "/dashboard": {
    title: "Welcome to your Dashboard",
    points: [
      "See low and out-of-stock products at a glance.",
      "Choose which widgets appear to suit how you work.",
      "Jump into any section from the sidebar.",
    ],
  },
  "/locations": {
    title: "Locations",
    points: [
      "Browse the storage locations in your organisation.",
      "Open a location to see its storage units and what's inside them.",
      "Add new locations as your space grows.",
    ],
  },
  "/floor-map": {
    title: "Floor Map",
    points: [
      "Draw a layout of a room or building.",
      "Place storage units where they physically sit.",
      "Click a unit to see its contents.",
    ],
  },
  "/inventory": {
    title: "Inventory",
    points: [
      "Search and filter every product you track.",
      "Open a product to adjust stock, see its history or print its barcode.",
      "Use “New product” to add stock to the system.",
    ],
  },
  "/lists": {
    title: "Shopping Lists",
    points: [
      "Generate a list from products at or below their reorder threshold.",
      "Set a budget to limit what gets included.",
      "Share a list by email when it's time to restock.",
    ],
  },
  "/scan": {
    title: "Scan",
    points: [
      "Point your camera at a barcode or QR code.",
      "Products open for a quick stock update.",
      "Location codes take you to that location.",
    ],
  },
  "/qr-codes": {
    title: "QR Codes",
    points: [
      "Generate QR labels for your locations and storage units.",
      "Print them and stick them where the items live.",
      "Scanning a label takes anyone straight to that spot.",
    ],
  },
  "/alerts": {
    title: "Stocktake",
    points: [
      "Review products that need attention.",
      "Schedule regular stocktakes for each location.",
      "Count stock to keep your numbers accurate.",
    ],
  },
  "/register": {
    title: "Create Account",
    points: [
      "Add a new team member to your organisation.",
      "Pick their role to control what they can see and change.",
    ],
  },
  "/accounts": {
    title: "Manage Accounts",
    points: ["See everyone in your organisation.", "Change roles or remove access when needed."],
  },
  "/settings": {
    title: "Settings",
    points: ["Update your preferences.", "Import products in bulk, or export your data."],
  },
};
