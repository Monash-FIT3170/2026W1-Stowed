import { FloorMapIcon } from "./FloorMapIcon";

export function MapActions({
  canManage,
  editing,
  onSave,
  onToggleMode,
  isMobile,
  panelOpen,
  onTogglePanel,
  panelTriggerRef,
  menuRef,
  menuTriggerRef,
  moreOpen,
  onToggleMore,
  onExport,
  onFloorSettings,
  onEditorSettings,
}) {
  return (
    <div
      className={`floor-map-toolbar-actions${editing ? " floor-map-toolbar-actions--editing" : ""}`}
    >
      <span className={`floor-map-mode${editing ? " is-editing" : ""}`} role="status">
        <FloorMapIcon name={editing ? "edit" : "eye"} size={15} />
        {editing ? "Edit mode" : "View mode"}
      </span>
      {editing && canManage && (
        <button
          type="button"
          className="btn-primary floor-map-save floor-map-action-save"
          onClick={onSave}
        >
          <FloorMapIcon name="save" />
          <span>{isMobile ? "Save" : "Save layout"}</span>
        </button>
      )}
      {editing && canManage && (
        <button
          ref={panelTriggerRef}
          type="button"
          className="floor-map-button floor-map-editor-trigger floor-map-action-tools"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-controls="floor-map-editor-wrap"
        >
          <FloorMapIcon name="panel" />
          <span>{isMobile ? "Tools" : panelOpen ? "Hide panel" : "Show panel"}</span>
        </button>
      )}
      {canManage && (
        <button
          type="button"
          className="floor-map-button floor-map-action-mode"
          onClick={onToggleMode}
        >
          <FloorMapIcon name={editing ? "check" : "edit"} />
          <span>{editing ? (isMobile ? "Done" : "Done editing") : "Edit layout"}</span>
        </button>
      )}
      {editing && canManage && (
        <div className="floor-map-more floor-map-action-more" ref={menuRef}>
          <button
            ref={menuTriggerRef}
            type="button"
            className="floor-map-button"
            onClick={onToggleMore}
            aria-expanded={moreOpen}
            aria-controls="floor-map-more-menu"
            aria-haspopup="menu"
          >
            <FloorMapIcon name="more" />
            <span>More</span>
          </button>
          {moreOpen && (
            <div
              id="floor-map-more-menu"
              className="floor-map-more-menu"
              role="menu"
              onKeyDown={(event) => {
                const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
                const index = items.indexOf(document.activeElement);
                const next =
                  event.key === "ArrowDown"
                    ? (index + 1) % items.length
                    : event.key === "ArrowUp"
                      ? (index - 1 + items.length) % items.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? items.length - 1
                          : -1;
                if (next >= 0) {
                  event.preventDefault();
                  items[next]?.focus();
                }
              }}
            >
              <button type="button" role="menuitem" onClick={onExport}>
                <FloorMapIcon name="download" />
                <span>Export PNG</span>
              </button>
              <button type="button" role="menuitem" onClick={onFloorSettings}>
                <FloorMapIcon name="map" />
                <span>Floor Map Settings</span>
              </button>
              <button type="button" role="menuitem" onClick={onEditorSettings}>
                <FloorMapIcon name="sliders" />
                <span>Editor Settings</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
