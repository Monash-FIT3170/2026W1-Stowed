import { buttonStyles, toolbarStyles } from "./FloorMapStyles";

/**
 * Horizontal top toolbar for undo/redo and layout actions.
 * Shape templates live in the right panel's Templates tab, not here.
 *
 * @param {() => void} onOpenCanvasSettings - Callback to open canvas settings modal
 * @param {() => void} onUndo - Callback to undo last action
 * @param {() => void} onRedo - Callback to redo last undone action
 * @param {boolean} canUndo - Whether there are actions to undo
 * @param {boolean} canRedo - Whether there are actions to redo
 *
 * @returns {JSX.Element} Toolbar UI element
 */
export function CanvasToolbar({
  onOpenCanvasSettings,
  onSaveLayout,
  onLoadLayout,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  const disabledStyle = (isDisabled) => (isDisabled ? buttonStyles.disabled : null);

  return (
    <div style={toolbarStyles.bar}>
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
