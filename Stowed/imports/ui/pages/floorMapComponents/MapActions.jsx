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
    <div className="floor-map-toolbar-actions">
      <span className={`floor-map-mode${editing ? " is-editing" : ""}`}>
        {editing ? "Editing layout" : "Viewing map"}
      </span>
      {editing && canManage && (
        <button type="button" className="btn-primary floor-map-save" onClick={onSave}>
          Save layout
        </button>
      )}
      {canManage && (
        <button type="button" className="floor-map-button" onClick={onToggleMode}>
          {editing ? "Done editing" : "Edit layout"}
        </button>
      )}
      {editing && canManage && (
        <button
          ref={panelTriggerRef}
          type="button"
          className="floor-map-button floor-map-editor-trigger"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-controls="floor-map-editor-wrap"
        >
          {isMobile ? "Editor tools" : panelOpen ? "Hide panel" : "Show panel"}
        </button>
      )}
      {editing && canManage && (
        <div className="floor-map-more" ref={menuRef}>
          <button
            ref={menuTriggerRef}
            type="button"
            className="floor-map-button"
            onClick={onToggleMore}
            aria-expanded={moreOpen}
            aria-controls="floor-map-more-menu"
          >
            More <span aria-hidden="true">⌄</span>
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
                Export PNG
              </button>
              <button type="button" role="menuitem" onClick={onFloorSettings}>
                Floor Map Settings
              </button>
              <button type="button" role="menuitem" onClick={onEditorSettings}>
                Editor Settings
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
