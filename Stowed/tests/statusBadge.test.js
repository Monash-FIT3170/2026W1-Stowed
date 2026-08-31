import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "../imports/ui/components/StatusBadge";

describe("statusBadge (boundary-safe)", function () {
  const render = (quantity, threshold) =>
    renderToStaticMarkup(React.createElement(StatusBadge, { quantity, threshold }));

  const label = (quantity, threshold) => {
    const match = render(quantity, threshold).match(/>([^<]+)<\/span>/);
    return match ? match[1] : null;
  };

  describe("NULL threshold", function () {
    it("renders In stock when threshold is null", function () {
      assert.strictEqual(label(10, null), "In stock");
    });

    it("still renders Out of stock at zero when threshold is null", function () {
      assert.strictEqual(label(0, null), "Out of stock");
    });
  });

  describe("LOW boundary (≤ threshold)", function () {
    it("Low stock at exactly threshold", function () {
      assert.strictEqual(label(20, 20), "Low stock");
    });

    it("Low stock just below threshold", function () {
      assert.strictEqual(label(19, 20), "Low stock");
    });

    it("Low stock at one unit remaining", function () {
      assert.strictEqual(label(1, 20), "Low stock");
    });
  });

  describe("IN STOCK boundary (> threshold)", function () {
    it("In stock just above threshold", function () {
      assert.strictEqual(label(21, 20), "In stock");
    });

    it("In stock far above threshold", function () {
      assert.strictEqual(label(100, 20), "In stock");
    });
  });

  describe("ZERO edge case", function () {
    it("Out of stock when quantity is 0, even below a threshold", function () {
      assert.strictEqual(label(0, 20), "Out of stock");
    });

    it("Out of stock when threshold is 0", function () {
      assert.strictEqual(label(0, 0), "Out of stock");
    });
  });

  describe("presentation", function () {
    it("carries no hazard icon or exclamation mark in any state", function () {
      [render(0, 20), render(5, 20), render(50, 20)].forEach((html) => {
        assert.ok(!html.includes("⚠"));
        assert.ok(!html.includes("!"));
      });
    });

    it("uses the shared status colour tokens", function () {
      assert.ok(render(50, 20).includes("var(--status-in-stock-bg)"));
      assert.ok(render(5, 20).includes("var(--status-low-stock-bg)"));
      assert.ok(render(0, 20).includes("var(--status-out-of-stock-bg)"));
    });
  });
});
