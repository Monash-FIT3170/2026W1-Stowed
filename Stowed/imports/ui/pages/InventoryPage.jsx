import React from "react";
import { Link } from "react-router-dom";
import { mockUser } from "../../api/mockUser";
import { mockItems, getLowStockItems, getTotalValue } from "../../api/mockItems";


export function InventoryPage() {

  const totalItems = mockItems.length;
  const lowStockCount = getLowStockItems(mockItems).length;
  const totalValue = getTotalValue(mockItems);

  return (
    <div style={{ padding: "24px" }}>
      Inventory Page

      <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: "32px", margin: "0 0 4px" }}>
        Hello, {mockUser.name}
      </h1>
      <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: "32px", fontStyle: "italic", margin: "0 0 24px" }}>
        Here's what's stocked.
      </h2>

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: "#D6EFE8", borderRadius: "16px", padding: "16px 20px", minWidth: "140px" }}>
          <div style={{ fontSize: "28px", fontWeight: 600 }}>{totalItems}</div>
          <div style={{ fontSize: "12px", color: "#4a8c78", marginTop: "4px" }}>Items tracked</div>
        </div>

        <div style={{ background: "#FAE0D6", borderRadius: "16px", padding: "16px 20px", minWidth: "140px" }}>
          <div style={{ fontSize: "28px", fontWeight: 600 }}>{lowStockCount}</div>
          <div style={{ fontSize: "12px", color: "#B5532A", marginTop: "4px" }}>Low stock</div>
        </div>

        <div style={{ background: "#FDF3D6", borderRadius: "16px", padding: "16px 20px", minWidth: "140px" }}>
          <div style={{ fontSize: "28px", fontWeight: 600 }}>${totalValue.toLocaleString()}</div>
          <div style={{ fontSize: "12px", color: "#997a2a", marginTop: "4px" }}>Total value</div>
        </div>
      </div>

      <div>
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