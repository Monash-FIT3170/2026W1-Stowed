import { buttonStyles, toolbarStyles } from "./FloorMapStyles";

/**
 * Toolbar component for selecting tools and adjusting floor dimensions.
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
    ...(activeTool === tool ? buttonStyles.active : buttonStyles.secondary),
  });

  const disabledStyle = (isDisabled) =>
    isDisabled ? buttonStyles.disabled : null;

  return (
    <div style={toolbarStyles.bar}>
      <div style={toolbarStyles.status}>
        <span>Active tool</span>
        <span style={toolbarStyles.statusBadge}>{activeToolLabel}</span>
      </div>

      {/* TOOLS */}
      <div style={toolbarStyles.row}>
        <button
          type="button"
          onClick={() => setActiveTool("select")}
          style={{ ...toolButtonStyle("select"), ...toolbarStyles.button }}
          aria-pressed={activeTool === "select"}
        >
          Select
        </button>
        <button
          type="button"
          onClick={() => setActiveTool("move")}
          style={{ ...toolButtonStyle("move"), ...toolbarStyles.button }}
          aria-pressed={activeTool === "move"}
        >
          Move
        </button>
      </div>

      <div style={toolbarStyles.row}>
        <button
          type="button"
          onClick={onSaveLayout}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.primary,
            ...toolbarStyles.button,
          }}
        >
          Save Layout
        </button>
        <button
          type="button"
          onClick={onLoadLayout}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.button,
          }}
        >
          Load Layout
        </button>
      </div>

      <div style={toolbarStyles.row}>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.button,
            ...disabledStyle(!canUndo),
          }}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.button,
            ...disabledStyle(!canRedo),
          }}
        >
          Redo
        </button>
      </div>
      <div style={toolbarStyles.rowSingle}>
        <button
          type="button"
          onClick={onOpenCanvasSettings}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            ...toolbarStyles.button,
          }}
        >
          Canvas Settings
        </button>
      </div>
    </div>
  );
}
