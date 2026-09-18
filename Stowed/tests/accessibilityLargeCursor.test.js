import assert from "assert";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AccessibilityWidget } from "../imports/ui/accessibility/AccessibilityWidget";

const LARGE_CURSOR_STORAGE_KEY = "stowed.a11y.largeCursor";

if (Meteor.isClient) {
  describe("accessibility: large cursor", function () {
    let container;
    let root;

    beforeEach(function () {
      window.localStorage.removeItem(LARGE_CURSOR_STORAGE_KEY);
      document.documentElement.classList.remove("a11y-large-cursor");
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
      document.documentElement.classList.remove("a11y-large-cursor");
      window.localStorage.removeItem(LARGE_CURSOR_STORAGE_KEY);
    });

    function largeCursorCheckbox() {
      const toggle = Array.from(container.querySelectorAll(".a11y-toggle")).find((label) =>
        label.textContent.includes("Large cursor"),
      );
      return toggle.querySelector('input[type="checkbox"]');
    }

    it("applies the large-cursor class to the document when enabled", function () {
      assert.strictEqual(document.documentElement.classList.contains("a11y-large-cursor"), false);

      act(() => {
        largeCursorCheckbox().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(document.documentElement.classList.contains("a11y-large-cursor"), true);
    });

    it("removes the large-cursor class when toggled back off", function () {
      act(() => {
        largeCursorCheckbox().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      act(() => {
        largeCursorCheckbox().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(document.documentElement.classList.contains("a11y-large-cursor"), false);
    });

    it("persists the preference to localStorage", function () {
      act(() => {
        largeCursorCheckbox().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(window.localStorage.getItem(LARGE_CURSOR_STORAGE_KEY), "true");
    });
  });
}
