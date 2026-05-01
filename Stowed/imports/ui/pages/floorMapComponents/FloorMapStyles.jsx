export const COLOURS = {
    // General Colour
    TEXT_COLOUR: "white",

    // Canvas Colours
    CANVAS_FILL: "gray",
    CANVAS_LABEL: "white"
}

export const storagePanelStyles = {
    panel: {
      display: "flex",
      width: 200,
      minWidth: 200,
      background: "#161616",
      borderRight: "1px solid #333",
      padding: "12px 10px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      overflowY: "auto",
    },
    sectionTitle: {
      color: "#666",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1,
      margin: "8px 0 4px",
    },
    card: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 10px",
      borderRadius: 6,
      cursor: "pointer",
      transition: "background 0.15s",
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 4,
      flexShrink: 0,
    },
    cardName: {
      color: "#eee",
      fontSize: 13,
      margin: 0,
    },
    cardSub: {
      color: "#666",
      fontSize: 11,
      margin: 0,
    },
    createBtn: {
      marginTop: 8,
      padding: "8px 0",
      background: "#252525",
      color: "#ccc",
      border: "1px dashed #444",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginTop: 4,
      padding: "10px 8px",
      background: "#1a1a1a",
      borderRadius: 6,
      border: "1px solid #333",
    },
    label: {
      color: "#888",
      fontSize: 11,
    },
    input: {
      background: "#252525",
      border: "1px solid #444",
      borderRadius: 4,
      color: "#eee",
      padding: "6px 8px",
      fontSize: 13,
      width: "100%",
      boxSizing: "border-box",
    },
    saveBtn: {
      marginTop: 4,
      padding: "8px 0",
      background: "#4A90D9",
      color: "white",
      border: "none",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
    },
  };
  
  export const modalStyles = {
    overlay: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
  
    modal: {
      background: "#fff",
      padding: "20px",
      borderRadius: "8px",
      width: "280px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
  
    title: {
      margin: 0,
      fontSize: "16px",
      fontWeight: "600",
    },
  
    field: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
  
    label: {
      fontSize: "12px",
      color: "#555",
    },
  
    input: {
      padding: "6px 8px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      fontSize: "14px",
    },
  
    checkboxRow: {
      fontSize: "13px",
    },
  
    actions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      marginTop: "10px",
    },
  
    buttonPrimary: {
      padding: "6px 10px",
      background: "#007bff",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    },
  
    buttonSecondary: {
      padding: "6px 10px",
      background: "#eee",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    },
  };
