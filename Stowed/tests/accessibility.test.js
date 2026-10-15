import assert from "assert";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AccessibilityWidget } from "../imports/ui/accessibility/AccessibilityWidget";

const CONTRAST_STORAGE_KEY = "stowed.a11y.highContrast";
const TEXT_SIZE_STORAGE_KEY = "stowed.a11y.textSize";
const LARGE_CURSOR_STORAGE_KEY = "stowed.a11y.largeCursor";
const ZOOM_STORAGE_KEY = "stowed.a11y.zoom";

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
      assert.strictEqual(document.documentElement.style.getPropertyValue("--a11y-font-scale"), "1");
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

  describe("accessibility: zoom", function () {
    let container;
    let root;

    function zoomIn() {
      return container.querySelector('button[aria-label="Zoom in"]');
    }

    function zoomOut() {
      return container.querySelector('button[aria-label="Zoom out"]');
    }

    function zoomValue() {
      return container.querySelector(".a11y-stepper-value").textContent;
    }

    beforeEach(function () {
      window.localStorage.removeItem(ZOOM_STORAGE_KEY);
      document.documentElement.style.removeProperty("--a11y-zoom");
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
      document.documentElement.style.removeProperty("--a11y-zoom");
      window.localStorage.removeItem(ZOOM_STORAGE_KEY);
    });

    it("defaults to 100% zoom", function () {
      assert.strictEqual(zoomValue(), "100%");
      assert.strictEqual(document.documentElement.style.getPropertyValue("--a11y-zoom"), "1");
    });

    it("increases the zoom level and CSS variable when zooming in", function () {
      act(() => {
        zoomIn().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(zoomValue(), "110%");
      assert.strictEqual(document.documentElement.style.getPropertyValue("--a11y-zoom"), "1.1");
    });

    it("decreases the zoom level when zooming out", function () {
      act(() => {
        zoomOut().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(zoomValue(), "90%");
    });

    it("clamps zoom at the maximum and disables the zoom-in button", function () {
      for (let i = 0; i < 10; i += 1) {
        act(() => {
          zoomIn().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
      }

      assert.strictEqual(zoomValue(), "150%");
      assert.strictEqual(zoomIn().disabled, true);
    });

    it("clamps zoom at the minimum and disables the zoom-out button", function () {
      for (let i = 0; i < 10; i += 1) {
        act(() => {
          zoomOut().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
      }

      assert.strictEqual(zoomValue(), "80%");
      assert.strictEqual(zoomOut().disabled, true);
    });

    it("persists the zoom level to localStorage", function () {
      act(() => {
        zoomIn().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      assert.strictEqual(window.localStorage.getItem(ZOOM_STORAGE_KEY), "1.1");
    });
  });

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
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
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
