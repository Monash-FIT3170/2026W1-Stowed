export const COLOURS = {
  // General Colour
  TEXT_COLOUR: "white",
  TEXT_PRIMARY: "#1a1a1a",
  TEXT_MUTED: "#998874",

  // Layout Colours
  PAGE_BG: "#eeece5",
  CARD_BG: "#ffffff",
  CARD_BORDER: "#efe7da",
  INPUT_BG: "#fdf7f2",

  // Button Colours
  BUTTON_BG: "#ffffff",
  BUTTON_BORDER: "#d9cfc0",
  BUTTON_TEXT: "#1a1a1a",
  ACCENT: "#b5532a",
  ACCENT_SOFT: "#fde8d8",

  // Canvas Colours
  TOOL_BAR_COLOUR: "#ffffff",
  UNIT_CARD_HOVER: "#f8efe6",
  CANVAS_FILL: "#fdf7f2",
  CANVAS_LABEL: "#998874",
  CANVAS_GRID: "#d9cfc0",

  // Storage unit colours
  UNIT_DEFAULT: "#7a5230",
  OVER_TRANSPARENT: "rgba(0, 0, 0, 0.08)",
  OVER_GREEN: "rgba(34, 197, 94, 0.50)",
  OVER_RED: "rgba(220, 38, 38, 0.60)",

  // Route colours
  WALKWAY_NODE_UNLINKED: "#dc2626",
  WALKWAY_NODE_LINKED: "#16a34a",
  WALKWAY_NODE_STROKE: "#ffffff",
  WALKWAY_NODE_SELECTED_STROKE: "#14532d",
  WALKWAY_LINK: "#16a34a",
};

const baseButton = {
  padding: "10px 18px",
  borderRadius: "999px",
  border: `1px solid ${COLOURS.BUTTON_BORDER}`,
  background: COLOURS.BUTTON_BG,
  color: COLOURS.BUTTON_TEXT,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  transition:
    "transform 0.05s ease, box-shadow 0.15s ease, background 0.15s ease, border 0.15s ease",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const buttonStyles = {
  base: baseButton,
  primary: {
    background: COLOURS.ACCENT,
    border: `1px solid ${COLOURS.ACCENT}`,
    color: "white",
  },
  secondary: {
    background: COLOURS.CARD_BG,
  },
  ghost: {
    background: "transparent",
    boxShadow: "none",
  },
  active: {
    background: COLOURS.ACCENT_SOFT,
    border: `1px solid ${COLOURS.ACCENT}`,
    color: COLOURS.TEXT_PRIMARY,
  },
  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    boxShadow: "none",
  },
};

export const pageStyles = {
  page: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    height: "100vh",
    background: COLOURS.PAGE_BG,
    padding: "16px 24px 24px",
    gap: 16,
    boxSizing: "border-box",
    overflow: "hidden",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: COLOURS.TEXT_PRIMARY,
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  breadcrumb: {
    margin: 0,
    fontSize: 12,
    color: COLOURS.TEXT_MUTED,
    fontWeight: 600,
  },
  title: {
    margin: "6px 0 4px",
    fontSize: 28,
    fontWeight: 700,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: COLOURS.TEXT_PRIMARY,
  },
  titleAccent: {
    color: COLOURS.ACCENT,
    fontStyle: "italic",
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: COLOURS.TEXT_MUTED,
    fontWeight: 600,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  mainRow: {
    flex: 1,
    display: "flex",
    gap: 16,
    overflow: "hidden",
    minHeight: 0,
    background: COLOURS.CARD_BG,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    borderRadius: 18,
  },
  canvasArea: {
    flex: 1,
    display: "flex",
    alignItems: "stretch",
    overflow: "hidden",
    background: COLOURS.CARD_BG,
  },
  sidebarBase: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    boxSizing: "border-box",
    background: COLOURS.CARD_BG,
    gap: 10,
    overflow: "hidden",
    transition: "width 0.2s ease, padding 0.2s ease",
  },
  sidebarOpen: {
    width: 280,
    minWidth: 260,
    padding: "12px",
  },
  sidebarCollapsed: {
    width: 44,
    minWidth: 44,
    padding: "8px 6px",
    alignItems: "center",
  },
  sidebarRight: {
    borderLeft: `1px solid ${COLOURS.CARD_BORDER}`,
  },
  sidebarToggle: {
    ...baseButton,
    padding: "6px 10px",
    minWidth: 28,
    alignSelf: "center",
  },
  sidebarDivider: {
    borderTop: `1px solid ${COLOURS.CARD_BORDER}`,
    marginTop: 3,
    paddingTop: 10,
  },
  sidebarFooter: {
    marginTop: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  floatingButton: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 1000,
  },
};

// Pill shared by the mode switcher and the icon buttons beside it
const statusPill = (isActive) => ({
  borderRadius: "999px",
  border: `1px solid ${isActive ? COLOURS.ACCENT : COLOURS.CARD_BORDER}`,
  color: isActive ? COLOURS.ACCENT : COLOURS.TEXT_MUTED,
  background: isActive ? COLOURS.ACCENT_SOFT : COLOURS.INPUT_BG,
  fontFamily: "inherit",
});

const statusBarButton = {
  fontSize: "12px",
  fontWeight: 600,
  color: COLOURS.TEXT_PRIMARY,
  background: COLOURS.CARD_BG,
  border: `1px solid ${COLOURS.CARD_BORDER}`,
  borderRadius: "8px",
  padding: "6px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};

/** Slim status row above the canvas: site selects, mode switcher, icon actions. */
export const statusBarStyles = {
  button: statusBarButton,
  primaryButton: {
    ...statusBarButton,
    background: COLOURS.ACCENT,
    borderColor: COLOURS.ACCENT,
    color: "white",
  },
  modeGroup: {
    display: "flex",
    gap: "6px",
  },
  modeButton: (isActive, isDisabled = false) => ({
    ...statusPill(isActive),
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "4px 10px",
    cursor: isDisabled ? "not-allowed" : isActive ? "default" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
  }),
  iconButton: (isActive = false) => ({
    ...statusPill(isActive),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    cursor: "pointer",
  }),
};

const sidebarTab = (isActive) => ({
  padding: "8px 10px",
  border: "none",
  borderBottom: isActive ? `2px solid ${COLOURS.ACCENT}` : "2px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: isActive ? 700 : 400,
  color: isActive ? COLOURS.ACCENT : COLOURS.TEXT_MUTED,
  fontFamily: "inherit",
});

/** Right-hand sidebar shared by edit mode and route mode. */
export const sidebarStyles = {
  panel: {
    width: "260px",
    minWidth: "260px",
    maxWidth: "260px",
    flexShrink: 0,
    background: COLOURS.CARD_BG,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flex: 1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "0 8px 0 14px",
    flexShrink: 0,
    borderBottom: `1px solid ${COLOURS.CARD_BORDER}`,
  },
  tab: sidebarTab,
  // Single, non-clickable heading styled like a selected tab
  heading: {
    ...sidebarTab(true),
    cursor: "default",
  },
  collapseButton: {
    ...pageStyles.sidebarToggle,
    fontSize: "11px",
    padding: "4px 8px",
    marginLeft: "auto",
  },
  collapsedStrip: {
    width: "32px",
    flexShrink: 0,
    background: COLOURS.CARD_BG,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: "14px",
    gap: "8px",
    flex: 1,
  },
  expandButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: COLOURS.TEXT_MUTED,
    fontSize: "14px",
    padding: "4px",
  },
};

export const toolbarStyles = {
  bar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    padding: "10px 20px",
    background: COLOURS.TOOL_BAR_COLOUR,
    borderBottom: `1px solid ${COLOURS.CARD_BORDER}`,
    boxShadow: "0 2px 8px rgba(26, 26, 26, 0.04)",
    width: "100%",
    boxSizing: "border-box",
    flexShrink: 0,
  },
  section: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  sectionDivider: {
    width: 1,
    alignSelf: "stretch",
    minHeight: 22,
    background: COLOURS.CARD_BORDER,
    flexShrink: 0,
  },
  spacer: {
    flex: 1,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
  },
  rowSingle: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  button: {
    width: "100%",
    borderRadius: 8,
    textAlign: "center",
    justifyContent: "center",
    padding: "6px 10px",
    fontSize: 11,
  },
  buttonInline: {
    borderRadius: 8,
    textAlign: "center",
    justifyContent: "center",
    padding: "6px 12px",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: COLOURS.TEXT_MUTED,
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flexShrink: 0,
  },
  statusBadge: {
    padding: "4px 8px",
    borderRadius: "999px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    background: COLOURS.INPUT_BG,
    color: COLOURS.TEXT_PRIMARY,
    fontWeight: 600,
    fontSize: 9,
    textTransform: "none",
    letterSpacing: 0,
    whiteSpace: "nowrap",
  },
  divider: {
    height: 1,
    background: COLOURS.CARD_BORDER,
  },
};

export const customShapesPanelStyles = {
  shapeButtonContent: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },

  shapePreview: {
    width: 28,
    height: 28,
    flexShrink: 0,
    display: "block",
  },
  container: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    boxSizing: "border-box",
  },

  title: {
    margin: 0,
    color: COLOURS.TEXT_MUTED,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  shapeRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
  },

  editButton: {
    minHeight: 40,
    padding: "6px 6px",
    border: "1px solid #d8d1c8",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    cursor: "pointer",
    fontSize: 16,
    color: "#7a5230",
  },

  shapeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 40,
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 11,
    textAlign: "left",
  },

  shapeName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 600,
  },

  shapeSize: {
    flexShrink: 0,
    marginLeft: 12,
    color: COLOURS.TEXT_MUTED,
    fontSize: 9,
    fontWeight: 500,
  },

  emptyState: {
    padding: "10px",
    border: `1px dashed ${COLOURS.BUTTON_BORDER}`,
    borderRadius: 8,
    color: COLOURS.TEXT_MUTED,
    fontSize: 11,
    textAlign: "center",
  },
};

export const storagePanelStyles = {
  panel: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    background: COLOURS.CARD_BG,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    borderRadius: 18,
    padding: "16px",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
    boxShadow: "0 8px 20px rgba(26, 26, 26, 0.04)",
  },

  sectionTitle: {
    color: COLOURS.TEXT_MUTED,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0,
    margin: "10px 0 4px",
  },

  card: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    cursor: "pointer",
    background: COLOURS.INPUT_BG,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    transition: "background 0.15s, border 0.15s, box-shadow 0.15s",
  },

  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    flexShrink: 0,
    border: `1px solid ${COLOURS.BORDER_SUBTLE}`,
  },

  cardName: {
    color: COLOURS.TEXT_PRIMARY,
    fontSize: 13,
    margin: 0,
  },

  cardSub: {
    color: COLOURS.TEXT_MUTED,
    fontSize: 11,
    margin: 0,
  },

  createBtn: {
    marginTop: 8,
    padding: "10px 0",
    width: "100%",
    background: COLOURS.CARD_BG,
    color: COLOURS.TEXT_PRIMARY,
    border: `1px dashed ${COLOURS.BUTTON_BORDER}`,
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 6,
    padding: "12px 10px",
    background: COLOURS.INPUT_BG,
    borderRadius: 12,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },

  label: {
    color: COLOURS.TEXT_MUTED,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0,
  },

  input: {
    background: COLOURS.CARD_BG,
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    borderRadius: 10,
    color: COLOURS.TEXT_PRIMARY,
    padding: "8px 10px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },

  saveBtn: {
    marginTop: 6,
    padding: "10px 0",
    width: "100%",
    background: COLOURS.ACCENT,
    color: "white",
    border: `1px solid ${COLOURS.ACCENT}`,
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
};

/** Route mode tool list - cards reuse the storage unit card look. */
export const routeToolbarStyles = {
  list: {
    padding: "12px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
  },
  card: (isActive, isHovered) => ({
    ...storagePanelStyles.card,
    background: isHovered ? COLOURS.UNIT_CARD_HOVER : storagePanelStyles.card.background,
    ...(isActive ? buttonStyles.active : {}),
    width: "100%",
    textAlign: "left",
    fontFamily: "inherit",
  }),
  iconTile: (isActive) => ({
    ...storagePanelStyles.swatch,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLOURS.CARD_BG,
    color: isActive ? COLOURS.ACCENT : COLOURS.TEXT_MUTED,
  }),
  cardText: {
    minWidth: 0,
  },
  cardName: (isActive) => ({
    ...storagePanelStyles.cardName,
    fontWeight: isActive ? 700 : 400,
  }),
};

export const locationPanelStyles = {
  panel: {
    padding: "13px",
    borderRadius: "14px",
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    background: COLOURS.CARD_BG,
    boxShadow: "0 8px 20px rgba(26, 26, 26, 0.04)",
  },
  title: {
    margin: 0,
    fontSize: 10,
    letterSpacing: "1.1px",
    color: COLOURS.TEXT_MUTED,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  helper: {
    margin: "6px 0 0",
    fontSize: 11,
    color: COLOURS.TEXT_MUTED,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "10px",
  },
  label: {
    margin: 0,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: COLOURS.TEXT_MUTED,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  input: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    outline: "none",
    background: COLOURS.INPUT_BG,
    color: COLOURS.TEXT_PRIMARY,
    fontSize: 11,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  addButton: {
    padding: "8px 10px",
    borderRadius: "999px",
    border: `1px dashed ${COLOURS.BUTTON_BORDER}`,
    background: COLOURS.CARD_BG,
    fontWeight: 600,
    cursor: "pointer",
    color: COLOURS.TEXT_PRIMARY,
    fontSize: 11,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  list: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: "10px",
    background: COLOURS.INPUT_BG,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
  },
  rowCode: {
    fontSize: 11,
    fontWeight: 700,
    color: COLOURS.TEXT_PRIMARY,
  },
  rowName: {
    fontSize: 10,
    color: COLOURS.TEXT_MUTED,
  },
  deleteButton: {
    border: "none",
    background: "transparent",
    color: COLOURS.ACCENT,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 11,
  },
};

export const modalStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(48, 38, 28, 0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    background: COLOURS.CARD_BG,
    padding: "16px",
    borderRadius: "13px",
    width: "280px",
    boxShadow: "0 16px 32px rgba(26, 26, 26, 0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    border: `1px solid ${COLOURS.CARD_BORDER}`,
  },

  title: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: COLOURS.TEXT_PRIMARY,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  label: {
    fontSize: "10px",
    color: COLOURS.TEXT_MUTED,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  input: {
    padding: "6px 8px",
    borderRadius: "8px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    fontSize: "11px",
    background: COLOURS.INPUT_BG,
    color: COLOURS.TEXT_PRIMARY,
  },

  checkboxRow: {
    fontSize: "11px",
    color: COLOURS.TEXT_PRIMARY,
    fontWeight: 600,
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "6px",
    marginTop: "8px",
  },

  buttonPrimary: {
    ...baseButton,
    padding: "8px 14px",
    fontSize: 11,
    background: COLOURS.ACCENT,
    border: `1px solid ${COLOURS.ACCENT}`,
    color: "white",
  },

  buttonSecondary: {
    ...baseButton,
    padding: "8px 14px",
    fontSize: 11,
    background: COLOURS.CARD_BG,
  },
};
