import { useState } from "react"; 
import { buttonStyles, toolbarStyles } from "./FloorMapStyles";
import { CANVAS_CONFIG } from "./canvas/CanvasConfig";

/**
 * Toolbar component for selecting tools and adjusting floor dimensions.
 *
 * @param {string} activeTool - Currently selected tool
 * @param {(tool: string) => void} setActiveTool - State setter for updating the active tool
 * @param {{ width: number, height: number }} floorSize - Floor dimensions in pixels
 * @param {(updater: Function) => void} setFloorSize - State setter for updating floor dimensions
 * @param {() => void} onOpenCanvasSettings - Callback to open canvas settings modal
 * @param {() => void} onUndo - Callback to undo last action
 * @param {() => void} onRedo - Callback to redo last undone action
 * @param {boolean} canUndo - Whether there are actions to undo
 * @param {boolean} canRedo - Whether there are actions to redo
 *
 * @returns {JSX.Element} Toolbar UI element
 */
export function CanvasToolbar({ activeTool, setActiveTool, floorSize, setFloorSize, onOpenCanvasSettings, onSaveLayout, onLoadLayout, onUndo, onRedo, canUndo, canRedo }) {
    // store input seperately from pixels to avoid crash
    const [inputMeters, setInputMeters] = useState({
      width: floorSize.width / CANVAS_CONFIG.PIXELS_PER_METER,
      height: floorSize.height /  CANVAS_CONFIG.PIXELS_PER_METER,
    });

    // floor dimension validation
    const updateDimension = (dimensionType, rawValue) => {
    setInputMeters((prev) => ({ ...prev, [dimensionType]: rawValue }));
      const val = Number(rawValue);
    if (rawValue === "" || Number.isNaN(val) || val <= 0) return;
    setFloorSize((prev) => ({
      ...prev,
      [dimensionType]: val * CANVAS_CONFIG.PIXELS_PER_METER,
    }));
    };

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
        {/* TOOLS */}
      <div style={toolbarStyles.group}>
        <button
          onClick={() => setActiveTool("select")}
          style={toolButtonStyle("select")}
        >
          Select
        </button>
        <button
          onClick={() => setActiveTool("move")}
          style={toolButtonStyle("move")}
        >
          Move
        </button>
      </div>

      <div style={toolbarStyles.group}>
        <button
          onClick={onSaveLayout}
          style={{ ...buttonStyles.base, ...buttonStyles.primary }}
        >
          Save Layout
        </button>
        <button
          onClick={onLoadLayout}
          style={{ ...buttonStyles.base, ...buttonStyles.secondary }}
        >
          Load Layout
        </button>
      </div>

      <div style={toolbarStyles.status}>
        <span>Active tool</span>
        <span style={toolbarStyles.statusBadge}>{activeToolLabel}</span>
        </div>
  
      <div style={toolbarStyles.actions}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
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
            ...disabledStyle(!canRedo),
          }}
        >
          Redo
        </button>
        <button
          onClick={onOpenCanvasSettings}
          style={{ ...buttonStyles.base, ...buttonStyles.secondary }}
        >
          Canvas Settings
        </button>
      </div>
      </div>
    );
}