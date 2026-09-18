import assert from "assert";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AccessibilityWidget } from "../imports/ui/accessibility/AccessibilityWidget";

const CONTRAST_STORAGE_KEY = "stowed.a11y.highContrast";

if (Meteor.isClient) {
  describe("accessibility: high contrast", function () {
    let container;
    let root;

    beforeEach(function () {
      window.localStorage.removeItem(CONTRAST_STORAGE_KEY);
      document.documentElement.classList.remove("a11y-contrast");
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
      document.documentElement.classList.remove("a11y-contrast");
      window.localStorage.removeItem(CONTRAST_STORAGE_KEY);
    });

    it("applies the high-contrast class to the document when enabled", function () {
      const checkbox = container.querySelector('input[type="checkbox"]');
      assert.strictEqual(document.documentElement.classList.contains("a11y-contrast"), false);

      act(() => {
        checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(document.documentElement.classList.contains("a11y-contrast"), true);
    });

    it("removes the high-contrast class when toggled back off", function () {
      const checkbox = container.querySelector('input[type="checkbox"]');

      act(() => {
        checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      act(() => {
        checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(document.documentElement.classList.contains("a11y-contrast"), false);
    });

    it("persists the preference to localStorage", function () {
      const checkbox = container.querySelector('input[type="checkbox"]');

      act(() => {
        checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(window.localStorage.getItem(CONTRAST_STORAGE_KEY), "true");
    });
  });
}
