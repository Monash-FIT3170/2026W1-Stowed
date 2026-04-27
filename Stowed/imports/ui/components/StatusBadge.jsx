import React from "react";

/**
 * Visual status indicator for an item's stock level.
 * Colours match the Bloom design palette.
 *
 * @param {Object} props
 * @param {number} props.quantity - Current stock quantity.
 * @param {number} props.threshold - User-defined low-stock threshold.
 */
export function StatusBadge({ quantity, threshold }) {
  let label;
  let style;

  if (quantity <= threshold) {
    label = "Low!";
    style = { background: "#F8DDD2", color: "#B5532A" };
  } else if (quantity <= threshold * 1.5) {
    label = "Getting low";
    style = { background: "#FAEAD0", color: "#C4882B" };
  } else {
    label = "In stock";
    style = { background: "#D5E5D0", color: "#4A7A5C" };
  }

  return (
    <span
      style={{
        ...style,
        padding: "2px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 500,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}