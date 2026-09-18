import assert from "assert";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AccessibilityWidget } from "../imports/ui/accessibility/AccessibilityWidget";

if (Meteor.isClient) {
  describe("accessibility: panel toggle", function () {
    let container;
    let root;

    function toggleButton() {
      return container.querySelector('button[aria-label="Accessibility options"]');
    }

    function panel() {
      return container.querySelector('[role="dialog"]');
    }

    beforeEach(function () {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => {
        root.render(React.createElement(AccessibilityWidget));
      });
    });

    afterEach(function () {
      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it("keeps the panel closed by default", function () {
      assert.strictEqual(panel(), null);
      assert.strictEqual(toggleButton().getAttribute("aria-expanded"), "false");
    });

    it("opens the panel as a labelled dialog when the toggle is clicked", function () {
      act(() => {
        toggleButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.ok(panel());
      assert.strictEqual(panel().getAttribute("aria-label"), "Accessibility");
      assert.strictEqual(toggleButton().getAttribute("aria-expanded"), "true");
      assert.strictEqual(toggleButton().getAttribute("aria-controls"), panel().id);
    });

    it("closes the panel when Escape is pressed", function () {
      act(() => {
        toggleButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      assert.ok(panel());

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });

      assert.strictEqual(panel(), null);
    });

    it("closes the panel when clicking outside the widget", function () {
      act(() => {
        toggleButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      assert.ok(panel());

      act(() => {
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      });

      assert.strictEqual(panel(), null);
    });

    it("closes the panel when the close button is clicked", function () {
      act(() => {
        toggleButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      act(() => {
        container
          .querySelector('button[aria-label="Close"]')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(panel(), null);
    });
  });
}
