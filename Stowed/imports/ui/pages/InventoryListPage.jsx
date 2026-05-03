import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { FilterChips } from "../components/FilterChips";
import { StatusBadge } from "../components/StatusBadge";
import { mockItems, getLowStockItems } from "../../api/mockItems";


export function ItemThumbnail({photoUrl,name}) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  if (!photoUrl || imgError) {
    return (
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          background: "#F5EFE6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 600,
          color: "#B5532A",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      onError={() => setImgError(true)}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "8px",
        objectFit: "contain",
        background: "#F5EFE6",
        flexShrink: 0,
      }}
    />
  );
}

export function InventoryListPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    let items = mockItems;

    if (activeFilter === "low-stock") {
      items = getLowStockItems(items);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => {
        const name = (item.name || "").toLowerCase();
        const tag = (item.tag || "").toLowerCase();
        const id = (item._id || "").toLowerCase();
        return (
          name.includes(query) || tag.includes(query) || id.includes(query)
        );
      });
    }

    return items;
  }, [activeFilter, searchQuery]);

  const lowStockCount = getLowStockItems(mockItems).length;

  const filters = [
    { id: "all", label: "All", count: mockItems.length },
    { id: "low-stock", label: "⚠ Low stock", count: lowStockCount },
    { id: "tag", label: "Tag ▾" },
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
          placeholder="Search by ID, name, or tag"
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
        Showing {filteredItems.length} of {mockItems.length}
        {activeFilter !== "all" &&
          ` · Filter: ${activeFilter.replace("-", " ")}`}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px 2fr 1fr 1fr 1fr 1fr",
          padding: "8px 0",
          borderBottom: "1px solid #D9CFC0",
          fontSize: "11px",
          color: "#998874",
          fontWeight: 500,
          alignItems: "center",
        }}
      >
        <span />
        <span>Item</span>
        <span>Tag</span>
        <span>Location</span>
        <span>Stock</span>
        <span>Status</span>
      </div>

      {filteredItems.length === 0 ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "#998874",
            fontSize: "13px",
          }}
        >
          No items match the current filters.
        </div>
      ) : (
        filteredItems.map((item) => (
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
              <Link
                to={`/inventory/${item._id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {item.name}
              </Link>
            </span>
            <span>
              <span
                style={{
                  background: "#F5EFE6",
                  color: "#5C4F3F",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: 500,
                }}
              >
                {item.tag || "—"}
              </span>
            </span>
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
