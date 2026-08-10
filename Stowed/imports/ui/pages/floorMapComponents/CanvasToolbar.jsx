import { buttonStyles, toolbarStyles } from "./FloorMapStyles";

/**
 * Horizontal top toolbar for selecting tools, undo/redo and layout actions.
 * Shape templates live in the right panel's Templates tab, not here.
 *
 * @param {string} activeTool - Currently selected tool
 * @param {(tool: string) => void} setActiveTool - State setter for updating the active tool
 * @param {() => void} onOpenCanvasSettings - Callback to open canvas settings modal
 * @param {() => void} onUndo - Callback to undo last action
 * @param {() => void} onRedo - Callback to redo last undone action
 * @param {boolean} canUndo - Whether there are actions to undo
 * @param {boolean} canRedo - Whether there are actions to redo
 *
 * @returns {JSX.Element} Toolbar UI element
 */
export function CanvasToolbar({
  activeTool,
  setActiveTool,
  onOpenCanvasSettings,
  onSaveLayout,
  onLoadLayout,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  const activeToolLabel = activeTool
    ? activeTool.charAt(0).toUpperCase() + activeTool.slice(1)
    : "None";

  const toolButtonStyle = (tool) => ({
    ...buttonStyles.base,
    ...toolbarStyles.buttonInline,
    ...(activeTool === tool ? buttonStyles.active : buttonStyles.secondary),
  });

  const disabledStyle = (isDisabled) => (isDisabled ? buttonStyles.disabled : null);

  return (
    <div style={toolbarStyles.bar}>
      {/* ACTIVE TOOL */}
      <div style={toolbarStyles.status}>
        <span>Tool</span>
        <span style={toolbarStyles.statusBadge}>{activeToolLabel}</span>
      </div>

      <div style={toolbarStyles.sectionDivider} />

      {/* TOOLS */}
      <div style={toolbarStyles.section}>
        <button
          onClick={() => setActiveTool("select")}
          style={toolButtonStyle("select")}
          aria-pressed={activeTool === "select"}
        >
          Select
        </button>
      </div>

      <div style={toolbarStyles.sectionDivider} />

      {/* UNDO / REDO */}
      <div style={toolbarStyles.section}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.buttonInline,
            ...disabledStyle(!canUndo),
          }}
        >
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.buttonInline,
            ...disabledStyle(!canRedo),
          }}
        >
          Redo
        </button>
      </div>

      <div style={toolbarStyles.spacer} />

      {/* LAYOUT + SETTINGS */}
      <div style={toolbarStyles.section}>
        <button
          onClick={onOpenCanvasSettings}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.buttonInline,
          }}
        >
          Canvas Settings
        </button>
        <button
          onClick={onLoadLayout}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.buttonInline,
          }}
        >
          Load Layout
        </button>
        <button
          onClick={onSaveLayout}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.primary,
            ...toolbarStyles.buttonInline,
          }}
        >
          Save Layout
        </button>
      </div>
    </div>
  );
}
