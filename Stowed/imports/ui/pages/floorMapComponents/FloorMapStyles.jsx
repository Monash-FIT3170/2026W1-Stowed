export const COLOURS = {
  // General Colour
  TEXT_COLOUR: "white",
  TEXT_PRIMARY: "#1a1a1a",
  TEXT_MUTED: "#998874",

  // Layout Colours
  PAGE_BG: "#f5efe6",
  CARD_BG: "#ffffff",
  CARD_BORDER: "#efe7da",
  BORDER_SUBTLE: "#d9cfc0",
  INPUT_BG: "#fdf7f2",
  TAG_BG: "#f5efe6",
  TAG_TEXT: "#5c4f3f",

  // Button Colours
  BUTTON_BG: "#fdf7f2",
  BUTTON_BORDER: "#d9cfc0",
  BUTTON_TEXT: "#1a1a1a",
  ACCENT: "#b5532a",
  ACCENT_SECONDARY: "#e89b6f",
  ACCENT_SOFT: "#fde8d8",

  // Canvas Colours
  TOOL_BAR_COLOUR: "#ffffff",
  UNIT_CARD_HOVER: "#fdf7f2",
  CANVAS_FILL: "#f5efe6",
  CANVAS_LABEL: "white",
};

const cardShadow = "0 2px 8px rgba(26, 26, 26, 0.04)";

const baseButton = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: `1px solid ${COLOURS.BUTTON_BORDER}`,
  background: COLOURS.BUTTON_BG,
  color: COLOURS.BUTTON_TEXT,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  transition:
    "transform 0.05s ease, box-shadow 0.15s ease, background 0.15s ease, border 0.15s ease",
};

export const buttonStyles = {
  base: baseButton,
  primary: {
    background: COLOURS.ACCENT,
    border: `1px solid ${COLOURS.ACCENT}`,
    color: COLOURS.CARD_BG,
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
    color: COLOURS.ACCENT,
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
    background: COLOURS.PAGE_BG,
    padding: 0,
    gap: 0,
    boxSizing: "border-box",
  },
  mainRow: {
    flex: 1,
    display: "flex",
    gap: 0,
    overflow: "hidden",
    minHeight: 0,
  },
  canvasArea: {
    flex: 1,
    display: "flex",
    alignItems: "stretch",
    overflow: "hidden",
  },
  sidebarBase: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    boxSizing: "border-box",
    background: COLOURS.CARD_BG,
    gap: 12,
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
    padding: "6px 8px",
    minWidth: 28,
    alignSelf: "center",
  },
  sidebarDivider: {
    borderTop: `1px solid ${COLOURS.CARD_BORDER}`,
    marginTop: 4,
    paddingTop: 12,
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
    gap: "12px",
    padding: "14px",
    background: COLOURS.TOOL_BAR_COLOUR,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    borderRadius: 14,
    boxShadow: cardShadow,
    width: "100%",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  rowSingle: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  button: {
    width: "100%",
    borderRadius: 999,
    textAlign: "center",
    justifyContent: "center",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    justifyContent: "space-between",
    color: COLOURS.TEXT_MUTED,
    fontSize: 12,
    fontWeight: 600,
  },
  statusBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    background: COLOURS.TAG_BG,
    color: COLOURS.TAG_TEXT,
    fontWeight: 600,
    fontSize: 12,
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
    borderRadius: 14,
    padding: "14px",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
    boxShadow: cardShadow,
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
    background: COLOURS.CARD_BG,
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
    padding: "8px 0",
    width: "100%",
    background: "transparent",
    color: COLOURS.TEXT_MUTED,
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
    borderRadius: 8,
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
    background: COLOURS.INPUT_BG,
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    borderRadius: 8,
    color: COLOURS.TEXT_PRIMARY,
    padding: "8px 10px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },

  saveBtn: {
    marginTop: 6,
    padding: "8px 0",
    width: "100%",
    background: COLOURS.ACCENT,
    color: COLOURS.CARD_BG,
    border: `1px solid ${COLOURS.ACCENT}`,
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
};

export const modalStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(52, 45, 39, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    background: COLOURS.CARD_BG,
    padding: "20px",
    borderRadius: "14px",
    width: "300px",
    boxShadow: cardShadow,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    border: `1px solid ${COLOURS.CARD_BORDER}`,
  },

  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: COLOURS.TEXT_PRIMARY,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    fontSize: "12px",
    color: COLOURS.TEXT_MUTED,
    fontWeight: 600,
  },

  input: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    background: COLOURS.INPUT_BG,
    fontSize: "14px",
  },

  checkboxRow: {
    fontSize: "13px",
    color: COLOURS.TEXT_PRIMARY,
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "10px",
  },

  buttonPrimary: {
    ...baseButton,
    background: COLOURS.ACCENT,
    border: `1px solid ${COLOURS.ACCENT}`,
    color: COLOURS.CARD_BG,
  },

  buttonSecondary: {
    ...baseButton,
    background: COLOURS.CARD_BG,
  },
};
