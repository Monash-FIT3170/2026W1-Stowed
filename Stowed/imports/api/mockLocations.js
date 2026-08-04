// imports/api/mockLocations.js

/**
 * Returns a date `months` before now, used to spread mock stocktake dates
 * across the last 12 months.
 */
function monthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

export const mockSites = [
  {
    _id: "site-1",
    name: "Mornington Hardware",
    description: "Main hardware shop floor.",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockFloorMaps = [
  {
    _id: "floormap-1",
    siteId: "site-1",
    name: "Ground Floor",
    imageUrl: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockStorageUnits = [
  {
    _id: "unit-cab-01",
    floorMapId: "floormap-1",
    name: "CAB-01",
    type: "cabinet",
    position: { x: 50, y: 150, width: 100, height: 100 },
    photoUrl: "/cab-01-tools.svg",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "unit-cab-02",
    floorMapId: "floormap-1",
    name: "CAB-02",
    type: "cabinet",
    position: { x: 200, y: 150, width: 100, height: 100 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "unit-sh-a1",
    floorMapId: "floormap-1",
    name: "SH-A1",
    type: "shelf",
    position: { x: 50, y: 50, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "unit-sh-a2",
    floorMapId: "floormap-1",
    name: "SH-A2",
    type: "shelf",
    position: { x: 150, y: 50, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "unit-dr-1",
    floorMapId: "floormap-1",
    name: "DR-1",
    type: "drawer",
    position: { x: 50, y: 300, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "unit-bin-01",
    floorMapId: "floormap-1",
    name: "BIN-01",
    type: "other",
    position: { x: 50, y: 400, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockStorageLocations = [
  {
    _id: "loc-1",
    storageUnitId: "unit-cab-01",
    name: "Drawer",
    code: "1",
    storedItems: [
      {
        itemId: "1",
        name: "AAA Battery Pack",
        sku: "BAT-AAA-4",
        quantity: 50,
        status: "OK",
      },
      {
        itemId: "2",
        name: "Safety Helmet",
        sku: "SAFE-HELM-01",
        quantity: 5,
        status: "CRITICAL",
      },
      {
        itemId: "3",
        name: "Hard Hat Liner",
        sku: "LINER-001",
        quantity: 0,
        status: "CRITICAL",
      },
    ],
    lastStocktakeAt: monthsAgo(1),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "loc-2",
    storageUnitId: "unit-cab-01",
    name: "Drawer",
    code: "2",
    storedItems: [
      {
        itemId: "4",
        name: "Work Gloves",
        sku: "GLOVES-01",
        quantity: 25,
        status: "OK",
      },
      {
        itemId: "5",
        name: "Steel Toe Boots",
        sku: "BOOTS-STEEL-01",
        quantity: 100,
        status: "OK",
      },
    ],
    lastStocktakeAt: monthsAgo(6),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "loc-5",
    storageUnitId: "unit-cab-01",
    name: "Drawer",
    code: "3",
    storedItems: [],
    lastStocktakeAt: monthsAgo(12),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockCanvasUnits = [
  {
    id: "unit-cab-01",
    name: "CAB-01",
    type: "cabinet",
    x: 50,
    y: 150,
    width: 100,
    height: 100,
    fill: "#6CBEAA",
  },
  {
    id: "unit-cab-02",
    name: "CAB-02",
    type: "cabinet",
    x: 200,
    y: 150,
    width: 100,
    height: 100,
    fill: "#E8A87C",
  },
  {
    id: "unit-sh-a1",
    name: "SH-A1",
    type: "shelf",
    x: 50,
    y: 50,
    width: 50,
    height: 50,
    fill: "#6CBEAA",
  },
  {
    id: "unit-sh-a2",
    name: "SH-A2",
    type: "shelf",
    x: 150,
    y: 50,
    width: 50,
    height: 50,
    fill: "#F6D860",
  },
  {
    id: "unit-dr-1",
    name: "DR-1",
    type: "drawer",
    x: 50,
    y: 300,
    width: 50,
    height: 50,
    fill: "#6CBEAA",
  },
  {
    id: "unit-bin-01",
    name: "BIN-01",
    type: "other",
    x: 50,
    y: 400,
    width: 50,
    height: 50,
    fill: "#6CBEAA",
  },
];

export function getMockStorageUnitById(unitId) {
  return mockStorageUnits.find((unit) => unit._id === unitId);
}

export function getMockStorageLocationsByUnitId(unitId) {
  return mockStorageLocations.filter((location) => location.storageUnitId === unitId);
}
