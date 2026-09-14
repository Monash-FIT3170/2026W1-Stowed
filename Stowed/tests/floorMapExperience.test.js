import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapActions } from "../imports/ui/pages/floorMapComponents/MapActions";
import {
  EditorTabs,
  MapSelectors,
  MapState,
} from "../imports/ui/pages/floorMapComponents/MapControls";
import {
  firstMapForSite,
  publicMaps,
  selectAvailableMap,
} from "../imports/ui/pages/floorMapComponents/mapSelection";
import {
  fitViewport,
  resizeViewport,
} from "../imports/ui/pages/floorMapComponents/canvas/editor/viewport";
import { initialCanvasState } from "../imports/ui/pages/floorMapComponents/canvas/editor/EditorReducer";
import { hasClientPermission } from "../imports/api/userMethods";
import { ROLES } from "../imports/api/roles";
import { Meteor } from "meteor/meteor";
import { FloorMaps, Sites, StorageUnits } from "../imports/api/locations/collections";
import { Organisations } from "../imports/api/organisations";

const sites = [
  { _id: "site-a", name: "Main site" },
  { _id: "site-b", name: "Annex" },
];
const maps = [
  { _id: "map-a", siteId: "site-a", name: "Ground", isPrivate: false },
  { _id: "map-private", siteId: "site-a", name: "Staff only", isPrivate: true },
  { _id: "map-b", siteId: "site-b", name: "Upper", isPrivate: false },
];

describe("Floor map experience", function () {
  it("includes public maps and excludes private maps from guest choices", function () {
    const visible = publicMaps(maps);
    assert.deepStrictEqual(
      visible.map((map) => map._id),
      ["map-a", "map-b"],
    );
    const markup = renderToStaticMarkup(
      <MapSelectors
        sites={sites}
        floorMaps={visible}
        currentSite={sites[0]}
        currentFloorMap={visible[0]}
        onSiteChange={() => {}}
        onFloorMapChange={() => {}}
        context="public"
      />,
    );
    assert.ok(markup.includes("Main site"));
    assert.ok(!markup.includes("Staff only"));
  });

  it("falls back when a stored guest map ID is invalid or private", function () {
    const visible = publicMaps(maps);
    assert.strictEqual(selectAvailableMap(visible, "deleted")._id, "map-a");
    assert.strictEqual(selectAvailableMap(visible, "map-private")._id, "map-a");
    assert.strictEqual(selectAvailableMap(visible, "map-b")._id, "map-b");
  });

  it("changes sites to an available map and marks the selected map", function () {
    const visible = publicMaps(maps);
    const next = firstMapForSite(visible, "site-b");
    assert.strictEqual(next._id, "map-b");
    const markup = renderToStaticMarkup(
      <MapSelectors
        sites={sites}
        floorMaps={visible}
        currentSite={sites[1]}
        currentFloorMap={next}
        onSiteChange={() => {}}
        onFloorMapChange={() => {}}
      />,
    );
    assert.ok(markup.includes('value="site-b" selected=""'));
    assert.ok(!markup.includes("Staff only"));
  });

  it("shows meaningful loading and empty map states", function () {
    assert.ok(
      renderToStaticMarkup(<MapState loading title="Loading floor maps…" />).includes(
        'role="status"',
      ),
    );
    assert.ok(
      renderToStaticMarkup(<MapState title="No floor maps yet" />).includes("No floor maps yet"),
    );
  });

  it("only offers layout editing to roles with locations.manage", function () {
    function actions(role, editing, moreOpen = false) {
      return renderToStaticMarkup(
        <MapActions
          canManage={hasClientPermission(role, "locations.manage")}
          editing={editing}
          isMobile
          panelOpen={false}
          moreOpen={moreOpen}
        />,
      );
    }
    assert.ok(!actions(ROLES.STANDARD, false).includes("Edit layout"));
    assert.ok(!actions(ROLES.STANDARD, true, true).includes("Save layout"));
    assert.ok(!actions(ROLES.STANDARD, true, true).includes("Floor Map Settings"));
    assert.ok(actions(ROLES.ADMIN, false).includes("Edit layout"));
    assert.ok(actions(ROLES.OWNER, true, true).includes("Save layout"));
    assert.ok(actions(ROLES.OWNER, true, true).includes("Export PNG"));
  });

  it("exposes mobile panel and action-menu controls with accessible state", function () {
    const markup = renderToStaticMarkup(
      <MapActions canManage editing isMobile panelOpen moreOpen />,
    );
    assert.ok(markup.includes('aria-controls="floor-map-editor-wrap"'));
    assert.ok(markup.includes('aria-controls="floor-map-more-menu"'));
    assert.ok(markup.includes('aria-expanded="true"'));
    assert.ok(markup.includes('role="menuitem"'));

    let panelOpened = false;
    let menuToggled = false;
    const tree = MapActions({
      canManage: true,
      editing: true,
      isMobile: true,
      panelOpen: false,
      moreOpen: false,
      onTogglePanel: () => {
        panelOpened = true;
      },
      onToggleMore: () => {
        menuToggled = true;
      },
    });
    const buttons = [];
    function collect(node) {
      if (!React.isValidElement(node)) return;
      if (node.type === "button") buttons.push(node);
      React.Children.forEach(node.props.children, collect);
    }
    collect(tree);
    buttons
      .find((button) => button.props["aria-controls"] === "floor-map-editor-wrap")
      .props.onClick();
    buttons
      .find((button) => button.props["aria-controls"] === "floor-map-more-menu")
      .props.onClick();
    assert.ok(panelOpened && menuToggled);
  });

  it("switches Storage Units and Templates with pointer and arrow keys", function () {
    let nextTab = null;
    const tree = EditorTabs({
      activeTab: "units",
      onChange: (tab) => {
        nextTab = tab;
      },
    });
    const tabs = React.Children.toArray(tree.props.children);
    assert.strictEqual(tabs[0].props["aria-selected"], true);
    assert.strictEqual(tabs[1].props["aria-selected"], false);
    tabs[1].props.onClick();
    assert.strictEqual(nextTab, "templates");
    tabs[0].props.onKeyDown({
      key: "ArrowRight",
      preventDefault() {},
      currentTarget: { parentElement: { querySelector: () => ({ focus() {} }) } },
    });
    assert.strictEqual(nextTab, "templates");
  });

  it("fits and resizes the viewport without changing logical map coordinates", function () {
    const floorSize = { width: 2000, height: 1000 };
    const unit = { x: 2, y: 3, width: 4, height: 2 };
    const firstSize = { width: 320, height: 300 };
    const fitted = resizeViewport(initialCanvasState, firstSize, floorSize);
    assert.deepStrictEqual(
      { scale: fitted.scale, stagePos: fitted.stagePos },
      fitViewport(firstSize, floorSize),
    );
    const secondSize = { width: 768, height: 420 };
    const resized = resizeViewport(fitted, secondSize, floorSize);
    const originalCenterX = (firstSize.width / 2 - fitted.stagePos.x) / fitted.scale;
    const resizedCenterX = (secondSize.width / 2 - resized.stagePos.x) / resized.scale;
    assert.strictEqual(resized.scale, fitted.scale);
    assert.ok(Math.abs(originalCenterX - resizedCenterX) < 0.00001);
    assert.deepStrictEqual(unit, { x: 2, y: 3, width: 4, height: 2 });
    assert.ok(
      resizeViewport(resized, secondSize, { width: 1000, height: 1000 }, true).scale >
        resized.scale,
    );
  });
});

if (Meteor.isServer) {
  describe("Public floor-map publication", function () {
    it("serves only public geometry for the requested organisation", async function () {
      const code = `map-${Date.now().toString(36)}`;
      const now = new Date();
      const orgId = await Organisations.insertAsync({
        name: "Map test",
        code,
        createdAt: now,
        updatedAt: now,
      });
      const siteId = await Sites.insertAsync({
        orgId,
        name: "Test site",
        createdAt: now,
        updatedAt: now,
      });
      const publicId = await FloorMaps.insertAsync({
        orgId,
        siteId,
        name: "Public test map",
        isPrivate: false,
        settings: { showGrid: true },
        imageUrl: "internal-reference",
        createdAt: now,
        updatedAt: now,
      });
      const privateId = await FloorMaps.insertAsync({
        orgId,
        siteId,
        name: "Private test map",
        isPrivate: true,
        createdAt: now,
        updatedAt: now,
      });
      const publicUnitId = await StorageUnits.insertAsync({
        orgId,
        floorMapId: publicId,
        name: "Public shelf",
        type: "shelf",
        shape: {
          orgId,
          shapeId: -1,
          name: "Rectangle",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          gridReference: { x: 0, y: 0 },
        },
        offset: { x: 1, y: 1 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        createdAt: now,
        updatedAt: now,
      });
      try {
        await import("../imports/api/publications");
        const publish = Meteor.server.publish_handlers["locations.publicFloorMaps"];
        const cursors = await publish.call({ ready: () => [] }, code);
        const publishedMaps = await cursors[1].fetchAsync();
        assert.deepStrictEqual(
          publishedMaps.map((map) => map._id),
          [publicId],
        );
        assert.ok(!publishedMaps.some((map) => map._id === privateId));
        assert.ok(publishedMaps.every((map) => !map.settings && !map.imageUrl));
        const units = await cursors[2].fetchAsync();
        assert.deepStrictEqual(
          units.map((unit) => unit._id),
          [publicUnitId],
        );
        assert.ok(units.every((unit) => !unit.orgId && !unit.qrGenerated && !unit.shape?.orgId));
      } finally {
        await StorageUnits.removeAsync(publicUnitId);
        await FloorMaps.removeAsync(publicId);
        await FloorMaps.removeAsync(privateId);
        await Sites.removeAsync(siteId);
        await Organisations.removeAsync(orgId);
      }
    });
  });
}
