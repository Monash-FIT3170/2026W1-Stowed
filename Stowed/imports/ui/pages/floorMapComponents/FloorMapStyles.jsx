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
    width: 220,
    minWidth: 220,
    background: "#f7f7f7",            
    borderRight: "1px solid #ddd",
    padding: "12px 10px",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
  },

  sectionTitle: {
    color: "#666",
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
    borderRadius: 6,
    cursor: "pointer",
    background: "#fff",                
    border: "1px solid #e5e5e5",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    transition: "background 0.15s, border 0.15s",
  },

  swatch: {
    width: 28,
    height: 28,
    borderRadius: 4,
    flexShrink: 0,
    border: "1px solid #ddd",
  },

  cardName: {
    color: "#222",
    fontSize: 13,
    margin: 0,
  },

  cardSub: {
    color: "#777",
    fontSize: 11,
    margin: 0,
  },

  createBtn: {
    marginTop: 8,
    padding: "8px 0",
    background: "#fff",
    color: "#333",
    border: "1px dashed #bbb",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 6,
    padding: "10px 8px",
    background: "#fff",
    borderRadius: 6,
    border: "1px solid #ddd",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },

  label: {
    color: "#555",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  input: {
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 4,
    color: "#222",
    padding: "6px 8px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },

  saveBtn: {
    marginTop: 6,
    padding: "8px 0",
    background: "#007bff",
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
