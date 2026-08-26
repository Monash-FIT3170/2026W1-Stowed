import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}
export function AddProductModal({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setError("");
    setResults(null);
    try {
      const data = await callMethod("products.searchByText", { query: trimmed });
      setResults(data);
    } catch (err) {
      setError(err.reason || err.message || "Search failed.");
    }
    setIsSearching(false);
  }

  function handleSelectResult(result) {
    navigate("/inventory/new", {
      state: {
        prefill: {
          name: result.title || "",
          unitCost: typeof result.sellPrice === "number" ? result.sellPrice : "",
          images: result.imageUrl ? [result.imageUrl] : [],
        },
      },
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={{ maxWidth: "480px", width: "100%" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-product-modal-title" className="modal-title" style={{ marginBottom: "16px" }}>
          Add Product
        </h3>

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Search for a product, e.g. Iphone 15"
            className="form-input"
            style={{ flex: 1 }}
            autoFocus
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            style={{ width: "auto", padding: "0 20px", whiteSpace: "nowrap" }}
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {error && <p className="warning-text">{error}</p>}

        {results && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "320px",
              overflowY: "auto",
              marginBottom: "12px",
            }}
          >
            {results.length === 0 && (
              <p style={{ fontSize: "13px", color: "var(--text-muted, #998874)" }}>
                No results found. Try a different search, or enter the product manually.
              </p>
            )}
            {results.map((result) => (
              <button
                key={result.immersiveProductPageToken || result.title}
                type="button"
                onClick={() => handleSelectResult(result)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle, #e5ddd0)",
                  background: "var(--card-bg-subtle, #f5efe6)",
                  cursor: "pointer",
                }}
              >
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt=""
                    style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: "40px", height: "40px", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {result.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #998874)" }}>
                    {typeof result.sellPrice === "number" ? `$${result.sellPrice}` : "Price n/a"}
                    {result.source ? ` · ${result.source}` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div
          className="modal-actions"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Link to="/inventory/new" onClick={onClose} className="item-view-more">
            Or enter manually
          </Link>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
