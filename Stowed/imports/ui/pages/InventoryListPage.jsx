import React, { useState, useMemo } from "react";
import { FilterChips } from "../components/FilterChips";
import { StatusBadge } from "../components/StatusBadge";

// Inline placeholder data — replace with import from imports/api/mockLowStockItems once cherry-picked
const PLACEHOLDER_ITEMS = [
  { _id: "1", name: "AAA Battery Pack", quantity: 50, lowStockThreshold: 10, location: "Aisle 4 - Section 1" },
  { _id: "2", name: "Safety Helmet",    quantity: 5,  lowStockThreshold: 10, location: "Aisle 3 - Section 2" },
  { _id: "3", name: "Hard Hat Liner",   quantity: 0,  lowStockThreshold: 5,  location: "Aisle 3 - Section 3" },
  { _id: "4", name: "Work Gloves",      quantity: 25, lowStockThreshold: 25, location: "Aisle 2 - Section 1" },
  { _id: "5", name: "Steel Toe Boots",  quantity: 100, lowStockThreshold: 20, location: "Aisle 1 - Section 4" },
];

function getLowStockPlaceholder(items) {
  return items.filter(
    (i) =>
      typeof i.quantity === "number" &&
      typeof i.lowStockThreshold === "number" &&
      i.quantity <= i.lowStockThreshold
  );
}

export function InventoryListPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    let items = PLACEHOLDER_ITEMS;

    if (activeFilter === "low-stock") {
      items = getLowStockPlaceholder(items);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(query));
    }

    return items;
  }, [activeFilter, searchQuery]);

  const lowStockCount = getLowStockPlaceholder(PLACEHOLDER_ITEMS).length;

  const filters = [
    { id: "all", label: "All", count: PLACEHOLDER_ITEMS.length },
    { id: "low-stock", label: "Low stock", count: lowStockCount },
    { id: "category", label: "Category ▾" },
    { id: "location", label: "Location ▾" },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      <div style={{ fontSize: "12px", color: "#998874", marginBottom: "8px" }}>
        Inventory / All items
      </div>

      <h1
        style={{
          fontSize: "24px",
          fontWeight: 500,
          fontFamily: "Georgia, serif",
          margin: "8px 0 16px",
        }}
      >
        All <em style={{ color: "#B5532A" }}>items</em>
      </h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find anything…"
          style={{
            flex: 1,
            background: "#F5EFE6",
            borderRadius: "16px",
            padding: "8px 14px",
            fontSize: "12px",
            border: "none",
            outline: "none",
          }}
        />
        <button
          style={{
            background: "#E89B6F",
            color: "#FFFFFF",
            padding: "6px 14px",
            borderRadius: "16px",
            border: "none",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + Add item
        </button>
      </div>

      <FilterChips
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div style={{ fontSize: "11px", color: "#998874", marginBottom: "8px" }}>
        Showing {filteredItems.length} of {PLACEHOLDER_ITEMS.length}
        {activeFilter !== "all" && ` · Filter: ${activeFilter.replace("-", " ")}`}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          padding: "8px 0",
          borderBottom: "1px solid #D9CFC0",
          fontSize: "11px",
          color: "#998874",
          fontWeight: 500,
        }}
      >
        <span>Item</span>
        <span>Location</span>
        <span>Stock</span>
        <span>Status</span>
      </div>

      {filteredItems.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#998874", fontSize: "13px" }}>
          No items match the current filters.
        </div>
      ) : (
        filteredItems.map((item) => (
          <div
            key={item._id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              padding: "10px 0",
              borderBottom: "0.5px solid #EFE7DA",
              fontSize: "13px",
              alignItems: "center",
            }}
          >
            <span>{item.name}</span>
            <span style={{ color: "#998874" }}>{item.location}</span>
            <span>
              {item.quantity}/{item.lowStockThreshold}
            </span>
            <StatusBadge
              quantity={item.quantity}
              threshold={item.lowStockThreshold}
            />
          </div>
        ))
      )}
    </div>
  );
}