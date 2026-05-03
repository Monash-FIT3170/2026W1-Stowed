import React from "react";
import { Link } from "react-router-dom";
import { mockUser } from "../../api/mockUser";
import { mockItems, getLowStockItems, getTotalValue, getRecentlyUpdatedItems } from "../../api/mockItems";
import { ItemThumbnail } from "../components/ItemThumbnail";
import { StatusBadge } from "../components/StatusBadge";


export function InventoryPage() {

  const totalItems = mockItems.length;
  const lowStockCount = getLowStockItems(mockItems).length;
  const totalValue = getTotalValue(mockItems);
  const recentItems = getRecentlyUpdatedItems(mockItems);

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

      <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: "20px" }}>Recently updated</div>
            <div style={{ fontSize: "12px", color: "#998874", marginTop: "2px" }}>{recentItems.length} of {mockItems.length} items shown</div>
          </div>
          <Link
            to="/inventory/list"
            style={{
              fontSize: "13px",
              color: "#1a1a1a",
              textDecoration: "none",
              border: "1px solid #D9CFC0",
              borderRadius: "20px",
              padding: "6px 14px",
            }}
          >
            View all →
          </Link>
        </div>

          {recentItems.map((item) => (
            <div
              key={item._id}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 2fr 1fr 1fr 1fr 1fr",
                padding: "10px 0",
                borderBottom: "0.5px solid #EFE7DA",
                fontSize: "13px",
                alignItems: "center",
                gap: "0 8px",
              }}
            >
              <ItemThumbnail photoUrl={item.photoUrl} name={item.name} />
              <span>
                <Link to={`/inventory/${item._id}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {item.name}
                </Link>
              </span>
              <span>
                <span style={{ background: "#F5EFE6", color: "#5C4F3F", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 500 }}>
                  {item.tag || "—"}
                </span>
              </span>
              <span style={{ color: "#998874" }}>{item.location}</span>
              <span>{item.quantity}/{item.lowStockThreshold}</span>
              <StatusBadge quantity={item.quantity} threshold={item.lowStockThreshold} />
            </div>
          ))}
      </div>
    </div>
  );
}
