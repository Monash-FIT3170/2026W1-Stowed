import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { FilterChips } from "../components/FilterChips";
import { StatusBadge } from "../components/StatusBadge";
import { mockItems, getLowStockItems } from "../../api/mockItems";
import "./InventoryListPage.css";

export function ItemThumbnail({ photoUrl, name }) {
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
    return <div className="item-thumbnail">{initials}</div>;
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      onError={() => setImgError(true)}
      className="item-thumbnail"
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
    <div className="inventory-list-container">
      <div className="breadcrumb">Inventory / All items</div>

      <h1 className="page-title">
        All <em>items</em>
      </h1>

      <div className="search-bar-container">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ID, name, or tag"
          className="search-input"
        />
        <button className="btn-add-item">+ Add item</button>
      </div>

      <FilterChips
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="filter-count">
        Showing {filteredItems.length} of {mockItems.length}
        {activeFilter !== "all" &&
          ` · Filter: ${activeFilter.replace("-", " ")}`}
      </div>

      <div className="table-header">
        <span />
        <span>Item</span>
        <span>Tag</span>
        <span>Location</span>
        <span>Stock</span>
        <span>Status</span>
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">No items match the current filters.</div>
      ) : (
        filteredItems.map((item) => (
          <div key={item._id} className="table-row">
            <ItemThumbnail photoUrl={item.photoUrl} name={item.name} />
            <span>
              <Link to={`/inventory/${item._id}`} className="item-name-link">
                {item.name}
              </Link>
            </span>
            <span>
              <span className="item-tag">{item.tag || "—"}</span>
            </span>
            <span className="item-location">{item.location}</span>
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
