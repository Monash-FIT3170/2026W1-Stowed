import React from "react";
import { Link } from "react-router-dom";

export function InventoryPage() {
  return (
    <div style={{ padding: "24px" }}>
      Inventory Page

      <div style={{ marginTop: "16px" }}>
        <Link
          to="/inventory/list"
          style={{
            color: "#B5532A",
            fontSize: "14px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          View all →
        </Link>
      </div>
    </div>
  );
}