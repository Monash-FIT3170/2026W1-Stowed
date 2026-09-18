import assert from "assert";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AccessibilityWidget } from "../imports/ui/accessibility/AccessibilityWidget";

const TEXT_SIZE_STORAGE_KEY = "stowed.a11y.textSize";

if (Meteor.isClient) {
  describe("accessibility: text size", function () {
    let container;
    let root;

    function segmentButton(label) {
      return Array.from(container.querySelectorAll(".a11y-segment")).find(
        (button) => button.textContent === label,
      );
    }

    beforeEach(function () {
      window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
      document.documentElement.style.removeProperty("--a11y-font-scale");
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => {
        root.render(React.createElement(AccessibilityWidget));
      });
      act(() => {
        container
          .querySelector('button[aria-label="Accessibility options"]')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    });

    afterEach(function () {
      act(() => {
        root.unmount();
      });
      container.remove();
      document.documentElement.style.removeProperty("--a11y-font-scale");
      window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
    });

    it("defaults to a font scale of 1 with Default marked as pressed", function () {
      assert.strictEqual(
        document.documentElement.style.getPropertyValue("--a11y-font-scale"),
        "1",
      );
      assert.strictEqual(segmentButton("Default").getAttribute("aria-pressed"), "true");
    });

    it("scales the content area up when Large is selected", function () {
      act(() => {
        segmentButton("Large").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(
        document.documentElement.style.getPropertyValue("--a11y-font-scale"),
        "1.15",
      );
      assert.strictEqual(segmentButton("Large").getAttribute("aria-pressed"), "true");
      assert.strictEqual(segmentButton("Default").getAttribute("aria-pressed"), "false");
    });

    it("scales further up when Larger is selected", function () {
      act(() => {
        segmentButton("Larger").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(
        document.documentElement.style.getPropertyValue("--a11y-font-scale"),
        "1.3",
      );
    });

    it("persists the selected text size to localStorage", function () {
      act(() => {
        segmentButton("Larger").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY), "larger");
    });
  });
}
