import assert from "assert";

import {
  hasLink,
  canLink,
  getConnectedNodeIds,
  getLinkedNodeIds,
  validateRouteGraph,
  removeNodes,
  getNodeType,
  ROUTE_NODE_TYPES,
  canLinkNodes,
  isProductLink,
  getProductAccessNodeIds,
  splitLink,
} from "../imports/api/locations/routeGraph";

const links = [
  { id: "l1", fromId: "a", toId: "b" },
  { id: "l2", fromId: "c", toId: "a" },
];

describe("Route graph links", function () {
  describe("hasLink", function () {
    it("finds a link in the direction it was created", function () {
      assert.strictEqual(hasLink(links, "a", "b"), true);
    });

    it("finds a link in the reverse direction", function () {
      assert.strictEqual(hasLink(links, "b", "a"), true);
      assert.strictEqual(hasLink(links, "a", "c"), true);
    });

    it("returns false for nodes that are not linked", function () {
      assert.strictEqual(hasLink(links, "b", "c"), false);
      assert.strictEqual(hasLink([], "a", "b"), false);
    });
  });

  describe("canLink", function () {
    it("allows linking two unlinked nodes", function () {
      assert.strictEqual(canLink(links, "b", "c"), true);
    });

    it("rejects a duplicate link in either direction", function () {
      assert.strictEqual(canLink(links, "a", "b"), false);
      assert.strictEqual(canLink(links, "b", "a"), false);
    });

    it("rejects linking a node to itself", function () {
      assert.strictEqual(canLink(links, "a", "a"), false);
    });

    it("rejects missing node ids", function () {
      assert.strictEqual(canLink(links, null, "a"), false);
      assert.strictEqual(canLink(links, "a", undefined), false);
    });
  });

  describe("getConnectedNodeIds", function () {
    it("returns every node at either end of any link", function () {
      assert.deepStrictEqual([...getConnectedNodeIds(links)].sort(), ["a", "b", "c"]);
    });

    it("returns an empty set when there are no links", function () {
      assert.strictEqual(getConnectedNodeIds([]).size, 0);
    });
  });

  describe("getLinkedNodeIds", function () {
    it("returns neighbours from both ends of each link", function () {
      assert.deepStrictEqual([...getLinkedNodeIds(links, "a")].sort(), ["b", "c"]);
    });

    it("returns an empty set for a node with no links", function () {
      assert.strictEqual(getLinkedNodeIds(links, "z").size, 0);
    });
  });
});

describe("validateRouteGraph", function () {
  const nodes = [
    { id: "a", x: 1, y: 1 },
    { id: "b", x: 2, y: 1 },
    { id: "c", x: 2, y: 2 },
  ];

  it("accepts a valid graph", function () {
    assert.strictEqual(validateRouteGraph(nodes, links), null);
  });

  it("accepts an empty graph", function () {
    assert.strictEqual(validateRouteGraph([], []), null);
  });

  it("rejects duplicate node ids", function () {
    assert.match(validateRouteGraph([...nodes, { id: "a", x: 3, y: 3 }], []), /Duplicate node/);
  });

  it("rejects negative or non-finite positions", function () {
    assert.match(validateRouteGraph([{ id: "a", x: -1, y: 0 }], []), /invalid position/);
    assert.match(validateRouteGraph([{ id: "a", x: NaN, y: 0 }], []), /invalid position/);
  });

  it("rejects duplicate link ids", function () {
    const dupIds = [
      { id: "l1", fromId: "a", toId: "b" },
      { id: "l1", fromId: "b", toId: "c" },
    ];
    assert.match(validateRouteGraph(nodes, dupIds), /Duplicate link id/);
  });

  it("rejects links to nodes that do not exist", function () {
    assert.match(
      validateRouteGraph(nodes, [{ id: "l1", fromId: "a", toId: "zzz" }]),
      /does not exist/,
    );
  });

  it("rejects a link from a node to itself", function () {
    assert.match(validateRouteGraph(nodes, [{ id: "l1", fromId: "a", toId: "a" }]), /duplicate or/);
  });

  it("rejects the same link added in reverse", function () {
    const reversed = [
      { id: "l1", fromId: "a", toId: "b" },
      { id: "l2", fromId: "b", toId: "a" },
    ];
    assert.match(validateRouteGraph(nodes, reversed), /duplicate or/);
  });
});

describe("Route node types", function () {
  it("treats nodes without a type as walkway nodes", function () {
    assert.strictEqual(getNodeType({ id: "a", x: 0, y: 0 }), ROUTE_NODE_TYPES.WALKWAY);
    assert.strictEqual(getNodeType({ id: "a", x: 0, y: 0, type: "product" }), "product");
  });

  it("accepts a product node attached to a storage unit", function () {
    const nodes = [
      { id: "w", x: 1, y: 1, type: "walkway" },
      { id: "p", x: 2, y: 1, type: "product", storageUnitId: "unit-1" },
    ];
    assert.strictEqual(validateRouteGraph(nodes, [{ id: "l", fromId: "w", toId: "p" }]), null);
  });

  it("rejects a product node with no storage unit", function () {
    assert.match(
      validateRouteGraph([{ id: "p", x: 1, y: 1, type: "product" }], []),
      /not attached to a storage unit/,
    );
  });

  it("rejects a walkway node attached to a storage unit", function () {
    assert.match(
      validateRouteGraph([{ id: "w", x: 1, y: 1, storageUnitId: "unit-1" }], []),
      /cannot be attached/,
    );
  });

  it("rejects an unknown node type", function () {
    assert.match(validateRouteGraph([{ id: "x", x: 1, y: 1, type: "door" }], []), /unknown type/);
  });
});

describe("removeNodes", function () {
  const nodes = [
    { id: "a", x: 0, y: 0 },
    { id: "p", x: 1, y: 0, type: "product", storageUnitId: "unit-1" },
    { id: "b", x: 2, y: 0 },
  ];
  const graphLinks = [
    { id: "l1", fromId: "a", toId: "p" },
    { id: "l2", fromId: "p", toId: "b" },
    { id: "l3", fromId: "a", toId: "b" },
  ];

  it("removes matching nodes and every link touching them", function () {
    const result = removeNodes(nodes, graphLinks, (node) => node.storageUnitId === "unit-1");
    assert.deepStrictEqual(
      result.nodes.map((n) => n.id),
      ["a", "b"],
    );
    assert.deepStrictEqual(
      result.links.map((l) => l.id),
      ["l3"],
    );
  });

  it("returns the graph unchanged when nothing matches", function () {
    const result = removeNodes(nodes, graphLinks, () => false);
    assert.strictEqual(result.nodes.length, 3);
    assert.strictEqual(result.links.length, 3);
  });
});

describe("Product node linking", function () {
  // w1 -- w2 is a walkway link; p1 and p2 are product nodes
  const nodes = [
    { id: "w1", x: 0, y: 0, type: "walkway" },
    { id: "w2", x: 4, y: 0, type: "walkway" },
    { id: "p1", x: 2, y: 2, type: "product", storageUnitId: "unit-1" },
    { id: "p2", x: 3, y: 2, type: "product", storageUnitId: "unit-2" },
  ];
  const walkwayLink = { id: "l1", fromId: "w1", toId: "w2" };

  describe("canLinkNodes", function () {
    it("allows a product node to link to a walkway node", function () {
      assert.strictEqual(canLinkNodes(nodes, [walkwayLink], "p1", "w1"), true);
    });

    it("rejects linking two product nodes", function () {
      assert.strictEqual(canLinkNodes(nodes, [walkwayLink], "p1", "p2"), false);
    });

    it("still rejects duplicate links", function () {
      assert.strictEqual(canLinkNodes(nodes, [walkwayLink], "w2", "w1"), false);
    });
  });

  it("validateRouteGraph rejects a link between two product nodes", function () {
    assert.match(
      validateRouteGraph(nodes, [{ id: "pp", fromId: "p1", toId: "p2" }]),
      /two product nodes/,
    );
  });

  it("isProductLink identifies links with a product node at either end", function () {
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    assert.strictEqual(isProductLink(nodesById, walkwayLink), false);
    assert.strictEqual(isProductLink(nodesById, { id: "x", fromId: "w1", toId: "p1" }), true);
    assert.strictEqual(isProductLink(nodesById, { id: "y", fromId: "p1", toId: "w2" }), true);
  });

  it("getProductAccessNodeIds returns walkway nodes linked to a product node", function () {
    const graphLinks = [walkwayLink, { id: "l2", fromId: "p1", toId: "w2" }];
    assert.deepStrictEqual([...getProductAccessNodeIds(nodes, graphLinks)], ["w2"]);
  });

  describe("splitLink", function () {
    const ids = { nodeId: "j", linkIdA: "la", linkIdB: "lb" };

    it("replaces the link with two links through a new walkway node", function () {
      const result = splitLink(nodes, [walkwayLink], "l1", { x: 2, y: 0 }, ids);

      const junction = result.nodes.find((n) => n.id === "j");
      assert.deepStrictEqual(junction, { id: "j", x: 2, y: 0, type: "walkway" });
      assert.deepStrictEqual(result.links, [
        { id: "la", fromId: "w1", toId: "j" },
        { id: "lb", fromId: "j", toId: "w2" },
      ]);
      assert.strictEqual(validateRouteGraph(result.nodes, result.links), null);
    });

    it("leaves other links untouched", function () {
      const other = { id: "l9", fromId: "p1", toId: "w1" };
      const result = splitLink(nodes, [walkwayLink, other], "l1", { x: 1, y: 0 }, ids);
      assert.ok(result.links.some((l) => l.id === "l9"));
      assert.strictEqual(result.links.length, 3);
    });

    it("returns null for a link that does not exist", function () {
      assert.strictEqual(splitLink(nodes, [walkwayLink], "missing", { x: 1, y: 0 }, ids), null);
    });
  });
});

describe("Product node storage locations", function () {
  const product = { id: "p", x: 1, y: 1, type: "product", storageUnitId: "unit-1" };

  it("accepts a product node listing the storage locations it can reach", function () {
    assert.strictEqual(
      validateRouteGraph([{ ...product, storageLocationIds: ["loc-1", "loc-2"] }], []),
      null,
    );
  });

  it("rejects a product node listing the same location twice", function () {
    assert.match(
      validateRouteGraph([{ ...product, storageLocationIds: ["loc-1", "loc-1"] }], []),
      /same storage location twice/,
    );
  });

  it("rejects storage locations on a walkway node", function () {
    assert.match(
      validateRouteGraph([{ id: "w", x: 1, y: 1, storageLocationIds: ["loc-1"] }], []),
      /cannot give access to storage locations/,
    );
  });
});

describe("Floor boundary", function () {
  const floor = { width: 10, height: 8 };
  const product = { id: "p", type: "product", storageUnitId: "unit-1" };

  it("accepts a product node inside the floor", function () {
    assert.strictEqual(validateRouteGraph([{ ...product, x: 5, y: 4 }], [], floor), null);
  });

  it("rejects a product node on any edge of the floor", function () {
    for (const position of [
      { x: 0, y: 4 },
      { x: 10, y: 4 },
      { x: 5, y: 0 },
      { x: 5, y: 8 },
    ]) {
      assert.match(
        validateRouteGraph([{ ...product, ...position }], [], floor),
        /on the floor boundary/,
      );
    }
  });

  it("rejects any node outside the floor", function () {
    assert.match(validateRouteGraph([{ id: "w", x: 11, y: 1 }], [], floor), /outside the floor/);
  });

  it("allows walkway nodes on the boundary", function () {
    assert.strictEqual(validateRouteGraph([{ id: "w", x: 0, y: 4 }], [], floor), null);
  });

  it("skips boundary checks when the floor size is unknown", function () {
    assert.strictEqual(validateRouteGraph([{ ...product, x: 0, y: 4 }], []), null);
  });
});
