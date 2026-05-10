import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products } from "../../api/products/collections";
import { FilterChips } from "../components/FilterChips";
import { StatusBadge } from "../components/StatusBadge";
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

  const { items, loading } = useTracker(() => {
    const sub = Meteor.subscribe("products");
    return {
      items: Products.find().fetch(),
      loading: !sub.ready(),
    };
  }, []);

  const filteredItems = useMemo(() => {
    let result = items;

    if (activeFilter === "low-stock") {
      result = result.filter((item) => item.totalQuantity <= 10);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const name = (item.name || "").toLowerCase();
        const tag = (item.tag || "").toLowerCase();
        const sku = (item.sku || "").toLowerCase();
        const id = (item._id || "").toLowerCase();
        return (
          name.includes(query) ||
          tag.includes(query) ||
          sku.includes(query) ||
          id.includes(query)
        );
      });
    }

    return result;
  }, [items, activeFilter, searchQuery]);

  const lowStockCount = items.filter((item) => item.totalQuantity <= 10).length;

  const filters = [
    { id: "all", label: "All", count: items.length },
    { id: "low-stock", label: "⚠ Low stock", count: lowStockCount },
    { id: "tag", label: "Tag ▾" },
    { id: "location", label: "Location ▾" },
  ];

  if (loading) {
    return <div className="inventory-list-container">Loading...</div>;
  }

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
          placeholder="Search by ID, name, tag, or SKU"
          className="search-input"
        />
        <Link to="/inventory/new">
          <button className="btn-add-item">+ Add item</button>
        </Link>
      </div>

      <FilterChips
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="filter-count">
        Showing {filteredItems.length} of {items.length}
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
            <span className="item-location">{item.location || "—"}</span>
            <span>{item.totalQuantity}</span>
            <StatusBadge quantity={item.totalQuantity} threshold={10} />
          </div>
        ))
      )}
    </div>
  );
}
