import React from "react";
import { Link } from "react-router-dom";
import { mockUser } from "../../api/mockUser";

export function InventoryPage() {
  return (
    <div style={{ padding: "24px" }}>
      Inventory Page

      <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: "32px", margin: "0 0 4px" }}>
        Hello, {mockUser.name}
      </h1>
      <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: "32px", fontStyle: "italic", margin: "0 0 24px" }}>
        Here's what's stocked.
      </h2>

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