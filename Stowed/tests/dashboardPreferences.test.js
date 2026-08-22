import assert from "assert";
import {
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  isDefaultDashboardPreferences,
  normalizeDashboardPreferences,
  reorderDashboardWidgets,
} from "../imports/ui/dashboardPreferences";

describe("dashboard preferences", function () {
  it("repairs malformed preferences and appends newly available widgets", function () {
    assert.deepStrictEqual(
      normalizeDashboardPreferences({
        order: ["recent", "unknown", "recent", "snapshot"],
        hidden: ["low-stock", "unknown", "low-stock"],
      }),
      {
        order: ["recent", "snapshot", "stocktake", "low-stock"],
        hidden: ["low-stock"],
      },
    );
  });

  it("returns defaults when no saved preferences exist", function () {
    assert.deepStrictEqual(normalizeDashboardPreferences(null), {
      order: DEFAULT_DASHBOARD_WIDGET_ORDER,
      hidden: [],
    });
  });

  it("moves a widget to the target position without mutating the original order", function () {
    const order = [...DEFAULT_DASHBOARD_WIDGET_ORDER];
    const reordered = reorderDashboardWidgets(order, "recent", "stocktake");

    assert.deepStrictEqual(reordered, ["snapshot", "recent", "stocktake", "low-stock"]);
    assert.deepStrictEqual(order, DEFAULT_DASHBOARD_WIDGET_ORDER);
  });

  it("detects whether the dashboard has been customized", function () {
    assert.strictEqual(isDefaultDashboardPreferences(normalizeDashboardPreferences(null)), true);
    assert.strictEqual(
      isDefaultDashboardPreferences({
        order: ["recent", "snapshot", "stocktake", "low-stock"],
        hidden: [],
      }),
      false,
    );
    assert.strictEqual(
      isDefaultDashboardPreferences({ order: DEFAULT_DASHBOARD_WIDGET_ORDER, hidden: ["recent"] }),
      false,
    );
  });
});
