import React from "react";

/**
 * Filter chip bar for the inventory list view.
 * Renders pill-style buttons; the active filter is visually distinguished.
 *
 * @param {Object} props
 * @param {Array<{id: string, label: string, count?: number}>} props.filters
 * @param {string} props.activeFilter - id of the currently active filter
 * @param {function} props.onFilterChange - callback receiving the new filter id
 */
export function FilterChips({ filters, activeFilter, onFilterChange }) {
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
      {filters.map((filter) => {
        const isActive = filter.id === activeFilter;
        const isLowStock = filter.id === "low-stock";

        let style;
        if (isActive && isLowStock) {
          style = { background: "#F8DDD2", color: "#B5532A", border: "none" };
        } else if (isActive) {
          style = { background: "#2C2419", color: "#FAF6F1", border: "none" };
        } else {
          style = { background: "#FFFFFF", color: "#5C4F3F", border: "0.5px solid #D9CFC0" };
        }

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            style={{
              ...style,
              padding: "5px 12px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: isActive ? 500 : 400,
              cursor: "pointer",
            }}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span style={{ marginLeft: "6px", opacity: 0.7 }}>{filter.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}