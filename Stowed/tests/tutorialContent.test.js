import assert from "assert";
import { SIDEBAR_TOUR_STEPS, PAGE_INTROS } from "../imports/ui/tutorial/tutorialContent";

describe("Tutorial content", function () {
  it("has a page intro for every sidebar tour step", function () {
    SIDEBAR_TOUR_STEPS.forEach((step) => {
      assert.ok(PAGE_INTROS[step.to], `missing page intro for ${step.to}`);
    });
  });

  it("has no intros for pages merged into or removed from the app", function () {
    assert.ok(!PAGE_INTROS["/accounts"], "account management lives in Settings now");
    assert.ok(!PAGE_INTROS["/register"], "team members are added from Settings now");
  });

  it("describes every section of the merged settings page", function () {
    const points = PAGE_INTROS["/settings"].points.join(" ");
    assert.ok(points.includes("organisation"));
    assert.ok(points.includes("team members"));
    assert.ok(points.includes("Import"));
  });
});
