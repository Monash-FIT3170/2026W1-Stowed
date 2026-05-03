// imports/api/mockLocations.js

export const mockSites = [
  {
    _id: 'site-1',
    name: 'Mornington Hardware',
    description: 'Main hardware shop floor.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockFloorMaps = [
  {
    _id: 'floormap-1',
    siteId: 'site-1',
    name: 'Ground Floor',
    imageUrl: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockStorageUnits = [
  {
    _id: 'unit-cab-01',
    floorMapId: 'floormap-1',
    name: 'CAB-01',
    type: 'cabinet',
    position: { x: 50, y: 150, width: 100, height: 100 },
    photoUrl: '/cab-01-tools.svg',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'unit-cab-02',
    floorMapId: 'floormap-1',
    name: 'CAB-02',
    type: 'cabinet',
    position: { x: 200, y: 150, width: 100, height: 100 },
    photoUrl: '/cab-02-fasteners.svg',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'unit-cab-03',
    floorMapId: 'floormap-1',
    name: 'CAB-03',
    type: 'cabinet',
    position: { x: 350, y: 150, width: 100, height: 100 },
    photoUrl: undefined, // no photo - tests the "no photo uploaded yet" state
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'unit-sh-a1',
    floorMapId: 'floormap-1',
    name: 'SH-A1',
    type: 'shelf',
    position: { x: 50, y: 50, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'unit-sh-a2',
    floorMapId: 'floormap-1',
    name: 'SH-A2',
    type: 'shelf',
    position: { x: 150, y: 50, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'unit-dr-1',
    floorMapId: 'floormap-1',
    name: 'DR-1',
    type: 'drawer',
    position: { x: 50, y: 300, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'unit-bin-01',
    floorMapId: 'floormap-1',
    name: 'BIN-01',
    type: 'other',
    position: { x: 50, y: 400, width: 50, height: 50 },
    photoUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockStorageLocations = [
  {
    _id: 'loc-1',
    storageUnitId: 'unit-cab-01',
    name: 'Cabinet 1 - Shelf A',
    code: 'CAB-01-A',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'loc-2',
    storageUnitId: 'unit-cab-01',
    name: 'Cabinet 1 - Shelf B',
    code: 'CAB-01-B',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'loc-3',
    storageUnitId: 'unit-cab-02',
    name: 'Cabinet 2 - Drawer 1',
    code: 'CAB-02-D1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'loc-4',
    storageUnitId: 'unit-cab-03',
    name: 'Cabinet 3 - Shelf A',
    code: 'CAB-03-A',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockCanvasUnits = [
  {
    id: 'unit-cab-01',
    name: 'CAB-01',
    type: 'cabinet',
    x: 50,
    y: 150,
    width: 100,
    height: 100,
    fill: '#6CBEAA',
  },
  {
    id: 'unit-cab-02',
    name: 'CAB-02',
    type: 'cabinet',
    x: 200,
    y: 150,
    width: 100,
    height: 100,
    fill: '#E8A87C',
  },
  {
    id: 'unit-cab-03',
    name: 'CAB-03',
    type: 'cabinet',
    x: 350,
    y: 150,
    width: 100,
    height: 100,
    fill: '#6CBEAA',
  },
  {
    id: 'unit-sh-a1',
    name: 'SH-A1',
    type: 'shelf',
    x: 50,
    y: 50,
    width: 50,
    height: 50,
    fill: '#6CBEAA',
  },
  {
    id: 'unit-sh-a2',
    name: 'SH-A2',
    type: 'shelf',
    x: 150,
    y: 50,
    width: 50,
    height: 50,
    fill: '#F6D860',
  },
  {
    id: 'unit-dr-1',
    name: 'DR-1',
    type: 'drawer',
    x: 50,
    y: 300,
    width: 50,
    height: 50,
    fill: '#6CBEAA',
  },
  {
    id: 'unit-bin-01',
    name: 'BIN-01',
    type: 'other',
    x: 50,
    y: 400,
    width: 50,
    height: 50,
    fill: '#6CBEAA',
  },
];

export function getMockStorageUnitById(unitId) {
  return mockStorageUnits.find((unit) => unit._id === unitId);
}

export function getMockStorageLocationsByUnitId(unitId) {
  return mockStorageLocations.filter((location) => location.storageUnitId === unitId);
}
