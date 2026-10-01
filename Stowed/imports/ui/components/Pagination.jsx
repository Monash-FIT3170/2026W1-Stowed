/**
 * Numbered page buttons, as used under the inventory list and the customer
 * product search. Renders nothing for a single page.
 *
 * @param {Object} props
 * @param {number} props.currentPage - 1-based page being shown.
 * @param {number} props.totalPages
 * @param {function} props.onPageChange - receives the chosen page number.
 */
export function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "12px",
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          aria-current={page === currentPage ? "page" : undefined}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: page === currentPage ? "none" : "1px solid var(--border-subtle)",
            background: page === currentPage ? "var(--accent-primary)" : "var(--card-bg)",
            color: page === currentPage ? "#fff" : "var(--text-muted)",
            fontWeight: page === currentPage ? 700 : 400,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          {page}
        </button>
      ))}
    </div>
  );
}
