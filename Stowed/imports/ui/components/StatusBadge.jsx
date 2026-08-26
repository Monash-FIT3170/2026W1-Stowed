/**
 * Visual status indicator for an item's stock level.
 *
 * Three states, matching the product detail header: out of stock at zero, low
 * at or below the reorder threshold, in stock otherwise. An item with no
 * threshold can only be out of stock or in stock.
 *
 * @param {Object} props
 * @param {number} props.quantity - Current stock quantity.
 * @param {number} props.threshold - User-defined low-stock threshold.
 */
export function StatusBadge({ quantity, threshold }) {
  let label;
  let style;

  if (quantity <= 0) {
    label = "Out of stock";
    style = {
      background: "var(--status-out-of-stock-bg)",
      color: "var(--status-out-of-stock-text)",
    };
  } else if (threshold != null && quantity <= threshold) {
    label = "Low stock";
    style = { background: "var(--status-low-stock-bg)", color: "var(--status-low-stock-text)" };
  } else {
    label = "In stock";
    style = { background: "var(--status-in-stock-bg)", color: "var(--status-in-stock-text)" };
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
