import { Link, useNavigate } from "react-router-dom";
import {
  ARCHIVED_SHOPPING_LIST_STORAGE_KEY,
  LIST_STATUSES,
  SAVED_SHOPPING_LIST_STORAGE_KEY,
} from "/imports/api/shoppingLists/constants";

import "./ListsPage.css";

const currency = (value) => value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

function readArchivedLists() {
  try {
    const stored = window.localStorage.getItem(ARCHIVED_SHOPPING_LIST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Could not read archived shopping lists:", error);
    return [];
  }
}

function formatArchivedAt(value) {
  if (!value) return "Archived";

  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ArchivedListsPage() {
  const navigate = useNavigate();
  const archivedLists = readArchivedLists();
  const latestArchive = archivedLists[0] ?? null;
  const items = latestArchive?.items ?? [];
  const totalUnits = items.reduce((sum, item) => sum + item.quantityWanted, 0);
  const estimatedCost = items.reduce(
    (sum, item) => sum + item.quantityWanted * (item.unitCost ?? 0),
    0,
  );
  const receivedCount = items.filter((item) => item.received).length;

  function unarchiveList() {
    if (!latestArchive) return;

    const existingSavedList = window.localStorage.getItem(SAVED_SHOPPING_LIST_STORAGE_KEY);
    if (existingSavedList) {
      const shouldReplace = window.confirm(
        "This will replace the current saved shopping list. Continue?",
      );
      if (!shouldReplace) return;
    }

    const restoredList = { ...latestArchive };
    delete restoredList.archivedAt;
    delete restoredList.archivedWithPendingItems;
    window.localStorage.setItem(
      SAVED_SHOPPING_LIST_STORAGE_KEY,
      JSON.stringify({
        ...restoredList,
        status: LIST_STATUSES.SAVED,
        unarchivedAt: new Date().toISOString(),
      }),
    );
    window.localStorage.setItem(
      ARCHIVED_SHOPPING_LIST_STORAGE_KEY,
      JSON.stringify(archivedLists.slice(1)),
    );
    navigate("/lists/saved");
  }

  return (
    <div className="product-detail-container">
      <div className="product-detail-header lists-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-link">Lists</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Archive</span>
        </div>

        <div className="header-top">
          <div>
            <h1 className="header-title">
              Archived <em>Shopping List</em>
            </h1>
            <p className="lists-subtitle">Read-only record of archived shopping lists.</p>
          </div>

          <div className="lists-header-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={unarchiveList}
              disabled={!latestArchive}
            >
              Unarchive
            </button>
            <Link to="/lists/saved" className="btn-secondary lists-link-button">
              Back to saved list
            </Link>
          </div>
        </div>
      </div>

      <div className="lists-body">
        {!latestArchive ? (
          <div className="detail-section lists-empty-card">
            <span className="lists-empty-icon" aria-hidden="true">
              &#128722;
            </span>
            <h2 className="header-title">No archived shopping lists</h2>
            <p className="section-empty">Archive a saved shopping list to keep it here.</p>
            <Link to="/lists/saved" className="btn-primary lists-link-button">
              View saved list
            </Link>
          </div>
        ) : (
          <>
            <div className="lists-stats">
              <div className="lists-stat lists-stat-items">
                <span className="lists-stat-value">{items.length}</span>
                <span className="lists-stat-label">Items archived</span>
              </div>
              <div className="lists-stat lists-stat-units">
                <span className="lists-stat-value">{totalUnits}</span>
                <span className="lists-stat-label">Units ordered</span>
              </div>
              <div className="lists-stat lists-stat-cost">
                <span className="lists-stat-value">{currency(estimatedCost)}</span>
                <span className="lists-stat-label">Estimated cost</span>
              </div>
            </div>

            <div className="detail-section lists-card">
              <div className="section-title">
                <span>Archived shopping list</span>
                <span className="section-badge im">Archived</span>
                <span className="lists-progress">
                  {formatArchivedAt(latestArchive.archivedAt)} &middot; {receivedCount} of{" "}
                  {items.length} received
                </span>
              </div>

              <div className="section-content">
                {latestArchive.archivedWithPendingItems && (
                  <p className="lists-warning-note">
                    This shopping list was archived before every item was marked received.
                  </p>
                )}

                <table className="lists-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="lists-col-num">In stock</th>
                      <th className="lists-col-num">Reorder at</th>
                      <th className="lists-col-num">Qty</th>
                      <th className="lists-col-check">Purchased</th>
                      <th className="lists-col-check">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.productId}
                        className={item.purchased ? "lists-row-purchased" : undefined}
                      >
                        <td>
                          <span className="lists-product-name">{item.productName}</span>
                          <span className="lists-product-meta">
                            {item.sku} &middot; {item.category}
                          </span>
                        </td>
                        <td className="lists-col-num">{item.inStock}</td>
                        <td className="lists-col-num">{item.reorderAt}</td>
                        <td className="lists-col-num">
                          <span className="form-tag lists-saved-qty">{item.quantityWanted}</span>
                        </td>
                        <td className="lists-col-check">
                          <input
                            type="checkbox"
                            checked={item.purchased}
                            disabled
                            readOnly
                            aria-label={`${item.productName} purchased status`}
                          />
                        </td>
                        <td className="lists-col-check">
                          <input
                            type="checkbox"
                            checked={item.received}
                            disabled
                            readOnly
                            aria-label={`${item.productName} received status`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
