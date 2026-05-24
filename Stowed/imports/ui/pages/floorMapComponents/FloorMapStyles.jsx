export const COLOURS = {
  // General Colour
  TEXT_COLOUR: "white",
  TEXT_PRIMARY: "#1a1a1a",
  TEXT_MUTED: "#998874",

  // Layout Colours
  PAGE_BG: "#f5efe6",
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
  CANVAS_GRID: "#e5d8cc",
};

const cardShadow = "0 2px 8px rgba(0,0,0,0.04)";

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

export const toolbarStyles = {
  bar: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "8px",
    padding: "10px",
    background: COLOURS.TOOL_BAR_COLOUR,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    borderRadius: 13,
    boxShadow: "0 8px 20px rgba(26, 26, 26, 0.06)",
    width: "100%",
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
  status: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    justifyContent: "space-between",
    color: COLOURS.TEXT_MUTED,
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
  },
  divider: {
    height: 1,
    background: COLOURS.CARD_BORDER,
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
  input: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    outline: "none",
    background: COLOURS.INPUT_BG,
    color: COLOURS.TEXT_PRIMARY,
    fontSize: 11,
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
