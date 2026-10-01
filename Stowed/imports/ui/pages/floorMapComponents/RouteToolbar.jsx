import { useState } from "react";
import {
  COLOURS,
  buttonStyles,
  customShapesPanelStyles,
  pageStyles,
  storagePanelStyles,
} from "./FloorMapStyles";
import { ROUTE_TOOLS } from "./canvas/editor/EditorContext";

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function WalkwayNodeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="5" r="2.5" />
      <line x1="7" y1="17" x2="17" y2="7" />
    </svg>
  );
}

function ProductNodeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

const TOOLS = [
  {
    tool: ROUTE_TOOLS.WALKWAY_NODE,
    name: "Walkway Node",
    description: "Place a point on a walkway",
    Icon: WalkwayNodeIcon,
  },
  {
    tool: ROUTE_TOOLS.LINK,
    name: "Link",
    description: "Connect two nodes",
    Icon: LinkIcon,
  },
  {
    tool: ROUTE_TOOLS.PRODUCT_NODE,
    name: "Product Node",
    description: "Link a walkway to a storage unit",
    Icon: ProductNodeIcon,
  },
];

/**
 * A single selectable tool, styled to match the storage unit cards in edit mode.
 */
function RouteToolCard({ name, description, Icon, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={isActive}
      style={{
        ...storagePanelStyles.card,
        background: hovered ? COLOURS.UNIT_CARD_HOVER : storagePanelStyles.card.background,
        ...(isActive ? buttonStyles.active : {}),
        width: "100%",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          ...storagePanelStyles.swatch,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLOURS.CARD_BG,
          color: isActive ? COLOURS.ACCENT : COLOURS.TEXT_MUTED,
        }}
      >
        <Icon />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ ...storagePanelStyles.cardName, fontWeight: isActive ? 700 : 400 }}>{name}</p>
        <p style={storagePanelStyles.cardSub}>{description}</p>
      </div>
    </button>
  );
}

/**
 * Sidebar shown on the right of the canvas in route mode.
 * Clicking a tool selects it; clicking the selected tool again deselects it.
 *
 * @param {{ activeTool: string | null, onSelectTool: (tool: string | null) => void, onCollapse: () => void }} props
 */
export function RouteToolbar({ activeTool, onSelectTool, onCollapse }) {
  return (
    <div
      style={{
        width: "260px",
        minWidth: "260px",
        maxWidth: "260px",
        flexShrink: 0,
        background: COLOURS.CARD_BG,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flex: 1,
      }}
    >
      {/* HEADER - mirrors the edit sidebar's tab row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 8px 0 14px",
          flexShrink: 0,
          borderBottom: `1px solid ${COLOURS.CARD_BORDER}`,
        }}
      >
        <span
          style={{
            padding: "8px 10px",
            borderBottom: `2px solid ${COLOURS.ACCENT}`,
            fontSize: "12px",
            fontWeight: 700,
            color: COLOURS.ACCENT,
          }}
        >
          Route Tools
        </span>
        <button
          onClick={onCollapse}
          style={{
            ...pageStyles.sidebarToggle,
            fontSize: "11px",
            padding: "4px 8px",
            marginLeft: "auto",
          }}
          aria-label="Collapse sidebar"
        >
          <img src="/sidebar-collapse.svg" alt="" width="18" height="18" />
        </button>
      </div>

      {/* TOOLS */}
      <div
        role="toolbar"
        aria-label="Route tools"
        aria-orientation="vertical"
        style={{
          padding: "12px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflowY: "auto",
        }}
      >
        <p style={customShapesPanelStyles.title}>Add to route</p>
        {TOOLS.map(({ tool, name, description, Icon }) => {
          const isActive = activeTool === tool;
          return (
            <RouteToolCard
              key={tool}
              name={name}
              description={description}
              Icon={Icon}
              isActive={isActive}
              onClick={() => onSelectTool(isActive ? null : tool)}
            />
          );
        })}
      </div>
    </div>
  );
}
