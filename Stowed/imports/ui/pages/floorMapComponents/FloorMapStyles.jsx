export const COLOURS = {
  // General Colour
  TEXT_COLOUR: "white",
  TEXT_PRIMARY: "#2f2b27",
  TEXT_MUTED: "#7b726a",

  // Layout Colours
  PAGE_BG: "#f4eee6",
  CARD_BG: "#ffffff",
  CARD_BORDER: "#eadfd2",

  // Button Colours
  BUTTON_BG: "#fff8f1",
  BUTTON_BORDER: "#e5d8cc",
  BUTTON_TEXT: "#4e463f",
  ACCENT: "#d6a28d",
  ACCENT_SOFT: "#f3d7c8",

  // Canvas Colours
  TOOL_BAR_COLOUR: "#ffffff",
  UNIT_CARD_HOVER: "#f7f1ea",
  CANVAS_FILL: "#e7dfd5",
  CANVAS_LABEL: "white",
};

const cardShadow = "0 2px 8px rgba(0,0,0,0.04)";

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
    background: COLOURS.PAGE_BG,
    padding: "16px",
    gap: "16px",
    boxSizing: "border-box",
  },
  mainRow: {
    flex: 1,
    display: "flex",
    gap: "16px",
    overflow: "hidden",
  },
  canvasShell: {
    flex: 1,
    display: "flex",
    alignItems: "stretch",
    background: COLOURS.CARD_BG,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    borderRadius: 18,
    boxShadow: cardShadow,
    overflow: "hidden",
  },
  canvasInner: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "auto",
    padding: "12px",
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
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    background: COLOURS.TOOL_BAR_COLOUR,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    borderRadius: 18,
    boxShadow: cardShadow,
  },
  group: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginLeft: "auto",
    color: COLOURS.TEXT_MUTED,
    fontSize: 12,
    fontWeight: 600,
  },
  statusBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
    background: COLOURS.BUTTON_BG,
    color: COLOURS.TEXT_PRIMARY,
    fontWeight: 600,
    fontSize: 12,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
};

export const storagePanelStyles = {
  panel: {
    display: "flex",
    width: 240,
    minWidth: 240,
    background: COLOURS.CARD_BG,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    borderRadius: 18,
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
    letterSpacing: 1,
    margin: "10px 0 4px",
  },

  card: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    cursor: "pointer",
    background: COLOURS.BUTTON_BG,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    transition: "background 0.15s, border 0.15s, box-shadow 0.15s",
  },

  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    flexShrink: 0,
    border: "1px solid #ddd",
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
    background: COLOURS.BUTTON_BG,
    borderRadius: 12,
    border: `1px solid ${COLOURS.CARD_BORDER}`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },

  label: {
    color: COLOURS.TEXT_MUTED,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  input: {
    background: "#fff",
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
    padding: "8px 0",
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
    borderRadius: "16px",
    width: "300px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
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
    borderRadius: "10px",
    border: `1px solid ${COLOURS.BUTTON_BORDER}`,
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
    color: "white",
  },

  buttonSecondary: {
    ...baseButton,
    background: COLOURS.CARD_BG,
  },
};
