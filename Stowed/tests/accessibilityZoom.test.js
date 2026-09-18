import assert from "assert";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AccessibilityWidget } from "../imports/ui/accessibility/AccessibilityWidget";

const ZOOM_STORAGE_KEY = "stowed.a11y.zoom";

if (Meteor.isClient) {
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
}
