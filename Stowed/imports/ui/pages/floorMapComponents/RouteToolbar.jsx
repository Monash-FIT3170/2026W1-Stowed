import { useState } from "react";
import {
  customShapesPanelStyles,
  routeToolbarStyles,
  sidebarStyles,
  storagePanelStyles,
} from "./FloorMapStyles";
import { LinkIcon, ProductNodeIcon, TrashIcon, WalkwayNodeIcon } from "./FloorMapIcons";
import { SidebarCollapseButton } from "./SidebarControls";
import { ROUTE_TOOLS } from "./canvas/editor/EditorContext";

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
    description: "Place on the side of a storage unit",
    Icon: ProductNodeIcon,
  },
  {
    tool: ROUTE_TOOLS.DELETE,
    name: "Delete",
    description: "Remove a node and its links, or a single link",
    Icon: TrashIcon,
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
      style={routeToolbarStyles.card(isActive, hovered)}
    >
      <div style={routeToolbarStyles.iconTile(isActive)}>
        <Icon />
      </div>
      <div style={routeToolbarStyles.cardText}>
        <p style={routeToolbarStyles.cardName(isActive)}>{name}</p>
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
    <div style={sidebarStyles.panel}>
      <div style={sidebarStyles.header}>
        <span style={sidebarStyles.heading}>Route Tools</span>
        <SidebarCollapseButton onClick={onCollapse} />
      </div>

      <div
        role="toolbar"
        aria-label="Route tools"
        aria-orientation="vertical"
        style={routeToolbarStyles.list}
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
