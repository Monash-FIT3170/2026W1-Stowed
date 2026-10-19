const AISLE_OFFSET_M = 1.5;

const centre = (x, width) => x + width / 2;
const round = (n) => Math.round(n * 100) / 100;

function buildShelfFloor({
  name,
  code,
  floorSize,
  unitType,
  unitWidth,
  unitHeight,
  unitXs,
  rowYs,
  shelfLabel,
}) {
  const units = [];
  const routeNodes = [];
  const routeLinks = [];

  const aisleYs = [
    ...new Set(
      rowYs.flatMap((y) => [round(y - AISLE_OFFSET_M), round(y + unitHeight + AISLE_OFFSET_M)]),
    ),
  ].sort((a, b) => a - b);

  const crossXs = [round(unitXs[0] - AISLE_OFFSET_M)];
  for (let i = 0; i < unitXs.length - 1; i++) {
    const gap = unitXs[i + 1] - (unitXs[i] + unitWidth);
    if (gap >= 2) crossXs.push(round(unitXs[i] + unitWidth + gap / 2));
  }
  crossXs.push(round(unitXs[unitXs.length - 1] + unitWidth + AISLE_OFFSET_M));

  const aisleXs = [
    ...new Set([...unitXs.map((x) => round(centre(x, unitWidth))), ...crossXs]),
  ].sort((a, b) => a - b);

  const nodeIdAt = (aisleIndex, x) => `a${aisleIndex}x${aisleXs.indexOf(x)}`;

  aisleYs.forEach((y, aisleIndex) => {
    aisleXs.forEach((x, xIndex) => {
      routeNodes.push({ id: nodeIdAt(aisleIndex, x), x, y });
      if (xIndex > 0) {
        routeLinks.push([nodeIdAt(aisleIndex, aisleXs[xIndex - 1]), nodeIdAt(aisleIndex, x)]);
      }
    });
    if (aisleIndex > 0) {
      for (const x of crossXs) {
        routeLinks.push([nodeIdAt(aisleIndex - 1, x), nodeIdAt(aisleIndex, x)]);
      }
    }
  });

  rowYs.forEach((rowY, rowIndex) => {
    unitXs.forEach((unitX, unitIndex) => {
      const letter = String.fromCharCode(65 + unitIndex);
      const unitName = `${shelfLabel} ${rowIndex + 1}${letter}`;
      const x = round(centre(unitX, unitWidth));

      const sides = [
        { label: "Top", y: rowY, aisleY: round(rowY - AISLE_OFFSET_M) },
        {
          label: "Bottom",
          y: rowY + unitHeight,
          aisleY: round(rowY + unitHeight + AISLE_OFFSET_M),
        },
      ];

      const locations = sides.map((side, sideIndex) => ({
        name: `${side.label} Bay`,
        code: `${code}-${rowIndex + 1}${letter}${sideIndex + 1}`,
        monthsAgo: (rowIndex * 5 + unitIndex * 3 + sideIndex * 2) % 13,
      }));

      units.push({
        name: unitName,
        type: unitType,
        width: unitWidth,
        height: unitHeight,
        x: unitX,
        y: rowY,
        locations,
      });

      sides.forEach((side, sideIndex) => {
        const nodeId = `p-${code}-${rowIndex + 1}${letter}${sideIndex + 1}`;
        routeNodes.push({
          id: nodeId,
          x,
          y: side.y,
          unit: unitName,
          locations: [locations[sideIndex].code],
        });
        routeLinks.push([nodeId, nodeIdAt(aisleYs.indexOf(side.aisleY), x)]);
      });
    });
  });

  return {
    floor: { name, floorSize, units },
    route: { floorName: name, nodes: routeNodes, links: routeLinks },
    locationCodes: units.flatMap((unit) => unit.locations.map((location) => location.code)),
  };
}

const MAIN_WAREHOUSE = buildShelfFloor({
  name: "Main Warehouse",
  code: "DC",
  floorSize: { width: 28, height: 19 },
  unitType: "shelf",
  unitWidth: 4,
  unitHeight: 1,
  unitXs: [3, 8, 15, 20],
  rowYs: [3, 7, 11, 15],
  shelfLabel: "Rack",
});

const PARTS_STORE = buildShelfFloor({
  name: "Mezzanine Parts Store",
  code: "MZ",
  floorSize: { width: 21, height: 11 },
  unitType: "rack",
  unitWidth: 3,
  unitHeight: 1,
  unitXs: [3, 7, 11, 15],
  rowYs: [3, 7],
  shelfLabel: "Parts Rack",
});

const CAMPUS_STORE = buildShelfFloor({
  name: "Campus Store – Ground Floor",
  code: "ST",
  floorSize: { width: 26, height: 15 },
  unitType: "shelf",
  unitWidth: 4,
  unitHeight: 1,
  unitXs: [3, 8, 14, 19],
  rowYs: [3, 7, 11],
  shelfLabel: "Gondola",
});

export const DEMO_SITES = [
  {
    site: {
      name: "Dandenong Distribution Centre",
      description: "Regional warehouse supplying all campuses.",
    },
    floors: [MAIN_WAREHOUSE.floor, PARTS_STORE.floor],
  },
  {
    site: {
      name: "Caulfield Campus Store",
      description: "Student and staff supplies store, Caulfield campus.",
    },
    floors: [CAMPUS_STORE.floor],
  },
];

export const DEMO_ROUTE_SEEDS = [MAIN_WAREHOUSE.route, PARTS_STORE.route, CAMPUS_STORE.route];

const WAREHOUSE_PRODUCTS = [
  ["Cable Ties (Pack of 100)", "Packaging", "Hellermann", 6.5],
  ["Duct Tape (48mm)", "Packaging", "Scotch", 7.9],
  ["Masking Tape (24mm)", "Packaging", "Scotch", 3.2],
  ["Packing Tape (Clear, 6pk)", "Packaging", "Scotch", 14.5],
  ["Bubble Wrap Roll (50m)", "Packaging", "Sealed Air", 32],
  ["Stretch Wrap Roll", "Packaging", "Sealed Air", 18.5],
  ["Cardboard Box (Medium)", "Packaging", "Visy", 2.4],
  ["Cardboard Box (Large)", "Packaging", "Visy", 3.8],
  ["Pallet Strapping Kit", "Pallet & Handling", "Cyklop", 45],
  ["Pallet Jack Gloves", "Pallet & Handling", "Ansell", 9.9],
  ["Box Cutter (Retractable)", "Pallet & Handling", "Olfa", 5.5],
  ["Label Gun", "Pallet & Handling", "Avery", 28],
  ["Thermal Labels (Roll of 500)", "Pallet & Handling", "Zebra", 12],
  ["Cut-Resistant Gloves", "Workwear & PPE", "Ansell", 11.5],
  ["Steel Cap Work Boots (Size 10)", "Workwear & PPE", "Blundstone", 169],
  ["Ear Muffs", "Workwear & PPE", "3M", 22],
  ["Dust Masks P2 (Box of 20)", "Workwear & PPE", "3M", 24],
  ["Hi-Vis Jacket", "Workwear & PPE", "Hard Yakka", 49],
  ["Safety Cones (450mm)", "Workwear & PPE", "Zions", 17],
  ["Caution Tape (100m)", "Workwear & PPE", "Zions", 8.5],
  ["Wet Floor Sign", "Facilities Supplies", "Zions", 21],
  ["Industrial Broom", "Facilities Supplies", "Oates", 19],
  ["Dustpan and Brush Set", "Facilities Supplies", "Oates", 12],
  ["Mop Bucket (Wringer)", "Facilities Supplies", "Oates", 54],
  ["Toilet Paper (48 Rolls)", "Facilities Supplies", "Quilton", 36],
  ["Hand Soap Refill (5L)", "Facilities Supplies", "Palmolive", 27],
  ["Floor Cleaner (5L)", "Facilities Supplies", "Pine O Cleen", 18],
  ["Degreaser Spray (750mL)", "Facilities Supplies", "Selleys", 9.5],
  ["Rubber Gloves (Large)", "Facilities Supplies", "Ansell", 4.5],
  ["LED Batten Light", "Facilities Supplies", "Philips", 29],
  ["Torch (Rechargeable)", "Facilities Supplies", "Ledlenser", 39],
  ["Extension Ladder (3m)", "Facilities Supplies", "Gorilla", 129],
];

const PARTS_PRODUCTS = [
  ["Cat6 Keystone Jack", "Electronic Components", "Belden", 3.2],
  ["RJ45 Connectors (Pack of 50)", "Electronic Components", "Belden", 14],
  ["Patch Panel (24-Port)", "Electronic Components", "Belden", 58],
  ["SFP Transceiver", "Electronic Components", "Cisco", 95],
  ["Rack Screws M6 (Pack of 50)", "Electronic Components", "Dynamix", 7.5],
  ["Velcro Cable Wraps (Pack of 20)", "Electronic Components", "Dynamix", 8.9],
  ["PoE Injector", "Electronic Components", "Ubiquiti", 32],
  ["Fibre Patch Lead (LC-LC)", "Electronic Components", "Dynamix", 15],
  ["Soldering Iron (60W)", "Tools", "Weller", 59],
  ["Solder Wire (100g)", "Tools", "Weller", 16],
  ["Multimeter (Digital)", "Tools", "Fluke", 119],
  ["Wire Strippers", "Tools", "Knipex", 34],
  ["Crimping Tool (RJ45)", "Tools", "Klein", 46],
  ["Precision Screwdriver Set", "Tools", "iFixit", 35],
  ["Heat Shrink Assortment", "Tools", "3M", 13.5],
  ["Anti-Static Wrist Strap", "Tools", "3M", 7],
];

const STORE_PRODUCTS = [
  ["A5 Notebook (Ruled)", "Stationery", "Spirax", 3.5],
  ["A4 Refill Pad", "Stationery", "Spirax", 4.2],
  ["Highlighters (Pack of 6)", "Stationery", "Stabilo", 7.5],
  ["Gel Pens (Pack of 10)", "Stationery", "Pilot", 9.9],
  ["Pencil Case", "Stationery", "Kikki", 8],
  ["Ring Binder (A4)", "Stationery", "Esselte", 4.8],
  ["Index Cards (Pack of 100)", "Stationery", "Spirax", 3.1],
  ["Scientific Calculator", "Stationery", "Casio", 29],
  ["USB Flash Drive (32GB)", "Tech Accessories", "SanDisk", 12],
  ["Phone Charger (USB-C)", "Tech Accessories", "Anker", 19],
  ["Wired Earbuds", "Tech Accessories", "JBL", 17],
  ["Laptop Sleeve (14in)", "Tech Accessories", "Targus", 24],
  ["Mouse Pad", "Tech Accessories", "Logitech", 9],
  ["Power Bank (10000mAh)", "Tech Accessories", "Anker", 39],
  ["Monash Hoodie (Navy)", "Merchandise", "Monash Uni", 59],
  ["Monash T-Shirt (White)", "Merchandise", "Monash Uni", 29],
  ["Monash Cap", "Merchandise", "Monash Uni", 24],
  ["Water Bottle (750mL)", "Merchandise", "Monash Uni", 19],
  ["Reusable Coffee Cup", "Merchandise", "Monash Uni", 14],
  ["Tote Bag", "Merchandise", "Monash Uni", 12],
  ["Lanyard", "Merchandise", "Monash Uni", 6],
  ["Backpack (25L)", "Merchandise", "Monash Uni", 49],
  ["Umbrella (Compact)", "Merchandise", "Monash Uni", 22],
  ["Keyring", "Merchandise", "Monash Uni", 5],
];

function planStock(codePrefix, floor, products) {
  const codes = floor.locationCodes;
  const catalogue = [];
  const plan = [];

  products.forEach(([name, category, brand, unitCost], i) => {
    const placements = [[codes[i % codes.length], 4 + ((i * 37) % 48)]];
    if (i % 3 === 0) {
      let second = (i * 5 + 7) % codes.length;
      if (codes[second] === placements[0][0]) second = (second + 1) % codes.length;
      placements.push([codes[second], 5 + ((i * 11) % 25)]);
    }

    catalogue.push({
      name,
      description: `${name} - demo stock for route testing.`,
      category,
      brand,
      sku: `${codePrefix}-${String(i + 1).padStart(3, "0")}`,
      unitCost,
      totalQuantity: placements.reduce((sum, [, quantity]) => sum + quantity, 0),
      reorderAt: 10,
    });
    for (const [code, quantity] of placements) plan.push([name, code, quantity]);
  });

  return { catalogue, plan };
}

const WAREHOUSE_STOCK = planStock("DCW", MAIN_WAREHOUSE, WAREHOUSE_PRODUCTS);
const PARTS_STOCK = planStock("DCM", PARTS_STORE, PARTS_PRODUCTS);
const STORE_STOCK = planStock("CST", CAMPUS_STORE, STORE_PRODUCTS);

const CROSS_SITE_STOCK = [
  {
    name: "Disposable Face Masks (Box of 50)",
    category: "Health & Safety",
    brand: "3M",
    unitCost: 11.5,
    placements: [
      ["SC-C1", 24],
      ["DC-2B1", 30],
    ],
  },
  {
    name: "Spill Absorbent Pads (Pack of 50)",
    category: "Facilities Supplies",
    brand: "Oates",
    unitCost: 26,
    placements: [
      ["WH-A1", 12],
      ["DC-3C2", 18],
    ],
  },
  {
    name: "Safety Data Sheet Binder",
    category: "Health & Safety",
    brand: "Esselte",
    unitCost: 9.5,
    placements: [
      ["SC-A2", 8],
      ["WH-B2", 6],
      ["DC-4A1", 10],
    ],
  },
];

const CROSS_SITE_PRODUCTS = CROSS_SITE_STOCK.map(({ placements, ...product }, i) => ({
  ...product,
  description: `${product.name} - stocked at both Clayton and Dandenong for route testing.`,
  sku: `XST-${String(i + 1).padStart(3, "0")}`,
  totalQuantity: placements.reduce((sum, [, quantity]) => sum + quantity, 0),
  reorderAt: 10,
}));

const CROSS_SITE_RECORDS = CROSS_SITE_STOCK.flatMap(({ name, placements }) =>
  placements.map(([code, quantity]) => [name, code, quantity]),
);

export const DEMO_PRODUCTS = [
  ...CROSS_SITE_PRODUCTS,
  ...WAREHOUSE_STOCK.catalogue,
  ...PARTS_STOCK.catalogue,
  ...STORE_STOCK.catalogue,
];

export const DEMO_RECORD_PLAN = [
  ...CROSS_SITE_RECORDS,
  ...WAREHOUSE_STOCK.plan,
  ...PARTS_STOCK.plan,
  ...STORE_STOCK.plan,
];
