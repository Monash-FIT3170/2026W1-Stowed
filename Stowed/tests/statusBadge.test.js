import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "../imports/ui/components/StatusBadge";

describe("statusBadge (boundary-safe)", function () {

  const render = (quantity, threshold) =>
    renderToStaticMarkup(
      React.createElement(StatusBadge, { quantity, threshold })
    );

  describe("NULL threshold", function () {
    it("renders In stock when threshold is null", function () {
      const html = render(10, null);
      assert.ok(html.includes("In stock"));
    });
  });

  describe("LOW boundary (≤ threshold)", function () {

    it("Low! at exactly threshold", function () {
      const html = render(20, 20);
      assert.ok(html.includes("Low!"));
    });

    it("Low! just below threshold", function () {
      const html = render(19, 20);
      assert.ok(html.includes("Low!"));
    });
  });

  describe("GETTING LOW boundary (threshold < q ≤ 1.5×threshold)", function () {

    it("Getting low just above threshold", function () {
      const html = render(21, 20);
      assert.ok(html.includes("Getting low"));
    });

    it("Getting low at 1.5x threshold", function () {
      const html = render(30, 20);
      assert.ok(html.includes("Getting low"));
    });

    it("Getting low just below 1.5x threshold", function () {
      const html = render(29, 20);
      assert.ok(html.includes("Getting low"));
    });
  });

  describe("IN STOCK boundary (> 1.5× threshold)", function () {

    it("In stock just above 1.5x threshold", function () {
      const html = render(31, 20);
      assert.ok(html.includes("In stock"));
    });

    it("In stock far above threshold", function () {
      const html = render(100, 20);
      assert.ok(html.includes("In stock"));
    });
  });

  describe("ZERO edge case", function () {

    it("Low! when quantity is 0", function () {
      const html = render(0, 20);
      assert.ok(html.includes("Low!"));
    });
  });

});