import assert from "assert";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { DirectionsModal } from "../imports/ui/components/DirectionsModal";

if (Meteor.isClient) {
  const floor = (id, siteName, productIds) => ({
    floorMapId: id,
    floorName: `Floor ${id}`,
    siteName,
    productIds,
  });

  describe("directions modal", function () {
    let container;
    let root;
    let onClose;

    const mount = (request) => {
      act(() => {
        root.render(React.createElement(DirectionsModal, { request, onClose }));
      });
    };
    const click = (element) =>
      act(() => {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

    beforeEach(function () {
      onClose = (() => {
        const fn = () => {
          fn.calls += 1;
        };
        fn.calls = 0;
        return fn;
      })();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(function () {
      act(() => {
        root.unmount();
      });
      container.remove();
    });

    const baseRequest = {
      floorMapId: "a",
      floorName: "Floor a",
      siteName: "Clayton",
      productIds: ["p1"],
      productNames: { p1: "Milk" },
      floors: [floor("a", "Clayton", ["p1"])],
    };

    it("renders an accessible dialog with the site and floor", function () {
      mount(baseRequest);
      const dialog = document.querySelector('.directions-modal[role="dialog"]');
      assert.ok(dialog);
      assert.strictEqual(dialog.getAttribute("aria-modal"), "true");
      assert.ok(dialog.textContent.includes("Clayton – Floor a"));
    });

    it("prompts the user to pick their location first", function () {
      mount(baseRequest);
      const status = document.querySelector(".directions-modal__status");
      assert.ok(status.textContent.includes("Click the map where you are standing now."));
      assert.strictEqual(status.querySelector("button"), null);
    });

    it("only shows the site/floor picker when several floors match", function () {
      mount(baseRequest);
      assert.strictEqual(document.querySelector(".directions-modal__floor"), null);

      mount({
        ...baseRequest,
        floors: [floor("a", "Clayton", ["p1"]), floor("b", "Caulfield", ["p1"])],
      });
      const options = document.querySelectorAll(".directions-modal__floor option");
      assert.strictEqual(options.length, 2);
      assert.ok(options[1].textContent.includes("Caulfield"));
    });

    it("closes from the close button, Escape and the backdrop", function () {
      mount(baseRequest);
      click(document.querySelector('button[aria-label="Close directions"]'));
      assert.strictEqual(onClose.calls, 1);

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      assert.strictEqual(onClose.calls, 2);

      click(document.querySelector(".directions-modal"));
      assert.strictEqual(onClose.calls, 2);
      click(document.querySelector(".directions-modal__overlay"));
      assert.strictEqual(onClose.calls, 3);
    });

    it("has a mobile layout for narrow screens", function () {
      const rules = [];
      const collect = (list) => {
        for (const rule of Array.from(list)) {
          if (rule.media && /max-width:\s*640px/.test(rule.media.mediaText)) {
            rules.push(...Array.from(rule.cssRules).map((r) => r.selectorText));
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          collect(sheet.cssRules);
        } catch (error) {
          continue;
        }
      }
      for (const selector of [
        ".directions-modal",
        ".directions-modal__overlay",
        ".directions-modal__status",
        ".directions-modal__stops",
      ]) {
        assert.ok(rules.includes(selector), `missing mobile rule for ${selector}`);
      }
    });
  });
}
