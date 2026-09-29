import assert from "assert";
import { Meteor } from "meteor/meteor";
import { describeServer } from "./serverOnly";
import { getStockStatus, searchProducts, STOCK_STATUS } from "../imports/api/products/filters";
import {
  buildLocationsByProductId,
  toCustomerProduct,
  CUSTOMER_SEARCH_FIELDS,
  filterCustomerProducts,
  sortCustomerProducts,
} from "../imports/api/customer/catalogue";
import { Organisations } from "../imports/api/organisations";
import { Products, ProductRecords } from "../imports/api/products/collections";
import { ProductCategories } from "../imports/api/categories/collections";
import { StorageUnits, StorageLocations } from "../imports/api/locations/collections";

const PRIVATE_FIELDS = [
  "orgId",
  "unitCost",
  "purchaseCost",
  "totalQuantity",
  "reorderAt",
  "sku",
  "status",
  "location",
  "qrCode",
  "createdAt",
  "updatedAt",
  "updatedByUserId",
  "updatedByUsername",
];

const staffProduct = {
  _id: "p-1",
  orgId: "org-1",
  name: "Claw Hammer",
  description: "Steel shaft",
  brand: "Stanley",
  categoryId: "cat-tools",
  sku: "HAM-001",
  unitCost: 24.5,
  purchaseCost: 11,
  reorderAt: 5,
  totalQuantity: 3,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  updatedByUserId: "u-1",
  updatedByUsername: "owner",
  images: ["https://example.com/hammer.jpg"],
};

const categoryNameById = new Map([["cat-tools", "Tools"]]);

function item(overrides) {
  return {
    _id: overrides.name,
    description: "",
    brand: "",
    categoryId: null,
    categoryName: "",
    price: null,
    images: [],
    stockStatus: STOCK_STATUS.IN,
    locations: [],
    ...overrides,
  };
}

describe("getStockStatus", function () {
  it("is out of stock at zero, whatever the threshold", function () {
    assert.strictEqual(getStockStatus(0, 5), STOCK_STATUS.OUT);
    assert.strictEqual(getStockStatus(0, null), STOCK_STATUS.OUT);
  });

  it("is low at and below the threshold", function () {
    assert.strictEqual(getStockStatus(5, 5), STOCK_STATUS.LOW);
    assert.strictEqual(getStockStatus(1, 5), STOCK_STATUS.LOW);
  });

  it("is in stock above the threshold or with none set", function () {
    assert.strictEqual(getStockStatus(6, 5), STOCK_STATUS.IN);
    assert.strictEqual(getStockStatus(1, null), STOCK_STATUS.IN);
  });
});

describe("customer product shape", function () {
  const locationsByProductId = buildLocationsByProductId(
    [
      { productId: "p-1", locationId: "loc-a", quantity: 1 },
      { productId: "p-1", locationId: "loc-b", quantity: 9 },
      { productId: "p-1", locationId: "loc-empty", quantity: 0 },
      { productId: "p-1", locationId: "loc-deleted", quantity: 4 },
    ],
    [
      { _id: "loc-a", name: "Shelf A", storageUnitId: "unit-1" },
      { _id: "loc-b", name: "Shelf B", storageUnitId: "unit-2" },
      { _id: "loc-empty", name: "Shelf C", storageUnitId: "unit-1" },
    ],
    [
      { _id: "unit-1", name: "Aisle 1" },
      { _id: "unit-2", name: "Aisle 2" },
    ],
  );
  const customer = toCustomerProduct(staffProduct, { categoryNameById, locationsByProductId });

  it("never carries staff-only fields", function () {
    for (const field of PRIVATE_FIELDS) {
      assert.ok(!(field in customer), `${field} leaked to the customer`);
    }
  });

  it("carries the shelf price, category name and stock status", function () {
    assert.strictEqual(customer.price, 24.5);
    assert.strictEqual(customer.categoryName, "Tools");
    assert.strictEqual(customer.stockStatus, STOCK_STATUS.LOW);
  });

  it("lists stocked locations fullest first, without quantities", function () {
    assert.deepStrictEqual(customer.locations, [
      { unitId: "unit-2", unitName: "Aisle 2", label: "Aisle 2 · Shelf B" },
      { unitId: "unit-1", unitName: "Aisle 1", label: "Aisle 1 · Shelf A" },
    ]);
  });

  it("reads an unpriced product as null rather than free", function () {
    const unpriced = toCustomerProduct(
      { ...staffProduct, unitCost: undefined },
      { categoryNameById, locationsByProductId },
    );
    assert.strictEqual(unpriced.price, null);
  });
});

describe("customer search, filter and sort", function () {
  const items = [
    item({
      name: "Claw Hammer",
      brand: "Stanley",
      categoryId: "tools",
      categoryName: "Tools",
      price: 20,
    }),
    item({
      name: "Paint Roller",
      categoryId: "paint",
      categoryName: "Paint",
      price: 8,
      stockStatus: STOCK_STATUS.OUT,
      locations: [{ unitId: "unit-2", unitName: "Aisle 2", label: "Aisle 2 · Shelf B" }],
    }),
    item({
      name: "Masking Tape",
      description: "Painter's tape",
      categoryId: "paint",
      categoryName: "Paint",
      stockStatus: STOCK_STATUS.LOW,
      locations: [{ unitId: "unit-1", unitName: "Aisle 1", label: "Aisle 1 · Shelf A" }],
    }),
  ];
  const names = (list) => list.map((i) => i.name);

  it("searches name, brand, description and category", function () {
    assert.deepStrictEqual(names(searchProducts(items, "stanley", CUSTOMER_SEARCH_FIELDS)), [
      "Claw Hammer",
    ]);
    assert.deepStrictEqual(names(searchProducts(items, "PAINT", CUSTOMER_SEARCH_FIELDS)), [
      "Paint Roller",
      "Masking Tape",
    ]);
    assert.strictEqual(searchProducts(items, "  ", CUSTOMER_SEARCH_FIELDS).length, 3);
  });

  it("does not search ids or SKUs", function () {
    const withSku = [{ ...items[0], _id: "HAM-001" }];
    assert.strictEqual(searchProducts(withSku, "HAM-001", CUSTOMER_SEARCH_FIELDS).length, 0);
  });

  it("filters by status, category and storage unit together", function () {
    assert.deepStrictEqual(names(filterCustomerProducts(items, { status: STOCK_STATUS.LOW })), [
      "Masking Tape",
    ]);
    assert.deepStrictEqual(names(filterCustomerProducts(items, { categoryId: "paint" })), [
      "Paint Roller",
      "Masking Tape",
    ]);
    assert.deepStrictEqual(
      names(filterCustomerProducts(items, { categoryId: "paint", unitId: "unit-2" })),
      ["Paint Roller"],
    );
    assert.strictEqual(filterCustomerProducts(items, {}).length, 3);
  });

  it("sorts by name either way", function () {
    assert.deepStrictEqual(names(sortCustomerProducts(items, "name-asc")), [
      "Claw Hammer",
      "Masking Tape",
      "Paint Roller",
    ]);
    assert.deepStrictEqual(names(sortCustomerProducts(items, "name-desc")), [
      "Paint Roller",
      "Masking Tape",
      "Claw Hammer",
    ]);
  });

  it("sorts by price with unpriced items last both ways", function () {
    assert.deepStrictEqual(names(sortCustomerProducts(items, "price-asc")), [
      "Paint Roller",
      "Claw Hammer",
      "Masking Tape",
    ]);
    assert.deepStrictEqual(names(sortCustomerProducts(items, "price-desc")), [
      "Claw Hammer",
      "Paint Roller",
      "Masking Tape",
    ]);
  });

  it("sorts by availability: in stock, then low, then out", function () {
    assert.deepStrictEqual(names(sortCustomerProducts(items, "availability")), [
      "Claw Hammer",
      "Masking Tape",
      "Paint Roller",
    ]);
  });

  it("falls back to name order for an unknown sort and leaves the input alone", function () {
    const before = names(items);
    assert.deepStrictEqual(names(sortCustomerProducts(items, "bogus")), [
      "Claw Hammer",
      "Masking Tape",
      "Paint Roller",
    ]);
    assert.deepStrictEqual(names(items), before);
  });
});

describeServer("customer catalogue methods", function () {
  const ORG_A = "cust-test-org-a";
  const ORG_B = "cust-test-org-b";

  // Written through the raw collections: the fixtures only need the fields the
  // methods read, not every field the full schemas require.
  const fixtures = [
    [
      Organisations,
      [
        { _id: ORG_A, code: "cust-test-a", name: "Store A" },
        { _id: ORG_B, code: "cust-test-b", name: "Store B" },
      ],
    ],
    [
      Products,
      [
        {
          _id: "cust-p-a",
          orgId: ORG_A,
          name: "Hammer",
          unitCost: 20,
          purchaseCost: 9,
          totalQuantity: 4,
          reorderAt: 2,
          categoryId: "cust-cat-a",
        },
        { _id: "cust-p-b", orgId: ORG_B, name: "Secret", unitCost: 5, totalQuantity: 1 },
      ],
    ],
    [ProductCategories, [{ _id: "cust-cat-a", orgId: ORG_A, name: "Tools" }]],
    [StorageUnits, [{ _id: "cust-unit-a", orgId: ORG_A, name: "Aisle 1" }]],
    [
      StorageLocations,
      [{ _id: "cust-loc-a", orgId: ORG_A, storageUnitId: "cust-unit-a", name: "Shelf A" }],
    ],
    [
      ProductRecords,
      [{ _id: "cust-rec-a", productId: "cust-p-a", locationId: "cust-loc-a", quantity: 4 }],
    ],
  ];

  async function clear() {
    for (const [collection, docs] of fixtures) {
      await collection.rawCollection().deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    }
  }

  function call(name, params) {
    // Anonymous, as a customer is: no userId on the invocation.
    return Meteor.server.method_handlers[name].call({ userId: null }, params);
  }

  before(async function () {
    await import("../imports/api/customer/methods");
    await clear();
    for (const [collection, docs] of fixtures) {
      await collection.rawCollection().insertMany(docs);
    }
  });

  after(clear);

  it("lists only the given organisation's products, whitelisted", async function () {
    const products = await call("customer.products.list", { orgCode: " CUST-TEST-A " });
    assert.deepStrictEqual(
      products.map((p) => p._id),
      ["cust-p-a"],
    );
    const [hammer] = products;
    assert.strictEqual(hammer.price, 20);
    assert.strictEqual(hammer.categoryName, "Tools");
    assert.strictEqual(hammer.stockStatus, STOCK_STATUS.IN);
    assert.deepStrictEqual(hammer.locations, [
      { unitId: "cust-unit-a", unitName: "Aisle 1", label: "Aisle 1 · Shelf A" },
    ]);
    for (const field of PRIVATE_FIELDS) {
      assert.ok(!(field in hammer), `${field} leaked to the customer`);
    }
  });

  it("gets one product of the organisation", async function () {
    const product = await call("customer.products.get", {
      orgCode: "cust-test-a",
      productId: "cust-p-a",
    });
    assert.strictEqual(product.name, "Hammer");
  });

  it("treats another organisation's product as not found", async function () {
    await assert.rejects(
      () => call("customer.products.get", { orgCode: "cust-test-a", productId: "cust-p-b" }),
      (err) => err.error === "not-found",
    );
  });

  it("rejects an unknown organisation code", async function () {
    await assert.rejects(
      () => call("customer.products.list", { orgCode: "no-such-store" }),
      (err) => err.error === "not-found",
    );
  });
});
