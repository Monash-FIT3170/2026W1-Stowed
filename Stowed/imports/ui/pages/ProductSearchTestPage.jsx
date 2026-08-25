import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { uploadImageToServer } from "/imports/api/upload";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export function ProductSearchTestPage() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  async function runSearch(promise) {
    setIsLoading(true);
    setError("");
    setResults(null);
    try {
      const data = await promise;
      setResults(data);
    } catch (err) {
      setError(err.reason || err.message || "Search failed.");
    }
    setIsLoading(false);
  }

  function handleTextSearch() {
    if (!query.trim()) return;
    runSearch(callMethod("products.searchByText", { query }));
  }

  async function handleImageFile(file) {
    if (!file) return;
    const imageUrl = await uploadImageToServer(file);
    runSearch(callMethod("products.searchByImage", { imageUrl }));
  }

  return (
    <div style={{ padding: "24px", maxWidth: "700px" }}>
      <h1>Add Product via Search</h1>

      <section style={{ marginBottom: "24px" }}>
        <h3>1. Search by text</h3>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g Iphone 15"
        />
        <button type="button" onClick={handleTextSearch} disabled={isLoading}>
          Search
        </button>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h3>2. Upload photo from gallery</h3>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleImageFile(e.target.files[0])}
          disabled={isLoading}
        />
      </section>

      {isLoading && <p>Searching...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {results && (
        <section>
          <h3>Results (top {results.length})</h3>
          <pre style={{ background: "#f4f4f4", padding: "12px", overflowX: "auto" }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
