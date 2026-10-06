import { sidebarStyles } from "./FloorMapStyles";

/**
 * Button in a right-hand sidebar header that collapses the sidebar.
 *
 * @param {{ onClick: () => void }} props
 */
export function SidebarCollapseButton({ onClick }) {
  return (
    <button onClick={onClick} style={sidebarStyles.collapseButton} aria-label="Collapse sidebar">
      <img src="/sidebar-collapse.svg" alt="" width="18" height="18" />
    </button>
  );
}

/**
 * Thin strip shown in place of a collapsed right-hand sidebar.
 *
 * @param {{ onExpand: () => void }} props
 */
export function CollapsedSidebar({ onExpand }) {
  return (
    <div style={sidebarStyles.collapsedStrip}>
      <button onClick={onExpand} style={sidebarStyles.expandButton} aria-label="Expand sidebar">
        <img src="/sidebar-expand.svg" alt="" width="18" height="18" />
      </button>
    </div>
  );
}
