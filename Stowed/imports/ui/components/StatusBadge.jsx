import { STOCK_STATUS, getStockStatus } from "/imports/api/products/filters";

const BADGES = {
  [STOCK_STATUS.OUT]: {
    label: "Out of stock",
    style: {
      background: "var(--status-out-of-stock-bg)",
      color: "var(--status-out-of-stock-text)",
    },
  },
  [STOCK_STATUS.LOW]: {
    label: "Low stock",
    style: { background: "var(--status-low-stock-bg)", color: "var(--status-low-stock-text)" },
  },
  [STOCK_STATUS.IN]: {
    label: "In stock",
    style: { background: "var(--status-in-stock-bg)", color: "var(--status-in-stock-text)" },
  },
};

/**
 * Visual status indicator for an item's stock level.
 *
 * Three states, matching the product detail header: out of stock at zero, low
 * at or below the reorder threshold, in stock otherwise. An item with no
 * threshold can only be out of stock or in stock.
 *
 * The customer catalogue never receives quantities, so it passes the status
 * the server already worked out instead.
 *
 * @param {Object} props
 * @param {number} [props.quantity] - Current stock quantity.
 * @param {number} [props.threshold] - User-defined low-stock threshold.
 * @param {string} [props.status] - A precomputed STOCK_STATUS; wins over quantity.
 */
export function StatusBadge({ quantity, threshold, status }) {
  const { label, style } = BADGES[status] ?? BADGES[getStockStatus(quantity, threshold)];

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
