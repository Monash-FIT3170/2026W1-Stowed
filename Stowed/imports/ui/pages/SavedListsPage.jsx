import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  ADD_PRODUCT_MODES,
  FREQUENCY_WEEKS,
  LIST_FREQUENCIES,
  LIST_FREQUENCY_LABELS,
  LIST_STATUSES,
  SAVED_SHOPPING_LIST_STORAGE_KEY,
} from "/imports/api/shoppingLists/constants";
import { Sites } from "/imports/api/locations/collections";
import { mockSites } from "/imports/api/mockLocations";

import "./ListsPage.css";

const currency = (value) => value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const FILTERS = {
  LOW_STOCK: "lowStock",
  ALL: "all",
  MANUAL: "manual",
};

function nextOrderDay(frequency) {
  const date = new Date();
  date.setDate(date.getDate() + (FREQUENCY_WEEKS[frequency] ?? 1) * 7);
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readSavedList() {
  try {
    const stored = window.localStorage.getItem(SAVED_SHOPPING_LIST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Could not read saved shopping list:", error);
    return null;
  }
}

export function SavedListsPage() {
  const navigate = useNavigate();
  const [savedList, setSavedList] = useState(() => readSavedList());
  const [filter, setFilter] = useState(FILTERS.ALL);

  const sites = useTracker(() => {
    Meteor.subscribe("locations.all");
    return Sites.find().fetch();
  }, []);

  useEffect(() => {
    function syncSavedList() {
      setSavedList(readSavedList());
    }

    window.addEventListener("storage", syncSavedList);
    return () => window.removeEventListener("storage", syncSavedList);
  }, []);

  const items = savedList?.items ?? [];
  const totalUnits = items.reduce((sum, item) => sum + item.quantityWanted, 0);
  const estimatedCost = items.reduce(
    (sum, item) => sum + item.quantityWanted * (item.unitCost ?? 0),
    0,
  );
  const purchasedCount = items.filter((item) => item.purchased).length;
  const receivedCount = items.filter((item) => item.received).length;
  const manual = items.filter((item) => item.addMode === ADD_PRODUCT_MODES.MANUAL);
  const generated = items.filter((item) => item.addMode !== ADD_PRODUCT_MODES.MANUAL);
  const visibleItems =
    filter === FILTERS.LOW_STOCK ? generated : filter === FILTERS.MANUAL ? manual : items;
  const isArchived = savedList?.status === LIST_STATUSES.ARCHIVED;
  const hasReceivedItems = items.some((item) => item.received);
  const locationOptions = (sites.length > 0 ? sites : mockSites).map((site) => ({
    id: site._id,
    label: site.name,
  }));
  const frequency = savedList?.frequency ?? LIST_FREQUENCIES.WEEKLY;

  function updateSavedList(updater) {
    setSavedList((current) => {
      if (!current) return current;

      const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
      window.localStorage.setItem(SAVED_SHOPPING_LIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateSavedItem(productId, updates) {
    updateSavedList((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.productId === productId ? { ...item, ...updates } : item,
      ),
    }));
  }

  function callStockMethod(methodName, item) {
    Meteor.call(
      methodName,
      { productId: item.productId, siteId: savedList?.siteId, quantity: item.quantityWanted },
      (error) => {
        if (error) console.error(`${methodName} failed:`, error);
      },
    );
  }

  function togglePurchased(item) {
    if (isArchived) return;

    const nextPurchased = !item.purchased;

    if (!nextPurchased && item.received) {
      callStockMethod("products.unreceiveStock", item);
    }

    updateSavedItem(item.productId, {
      purchased: nextPurchased,
      received: nextPurchased ? item.received : false,
    });
  }

  function toggleReceived(item) {
    if (isArchived || !item.purchased || !savedList?.siteId) return;

    const nextReceived = !item.received;
    callStockMethod(nextReceived ? "products.receiveStock" : "products.unreceiveStock", item);
    updateSavedItem(item.productId, { received: nextReceived });
  }

  function setListLocation(siteId) {
    updateSavedList({ siteId });
  }

  function setListFrequency(nextFrequency) {
    updateSavedList({ frequency: nextFrequency });
  }

  function archiveList() {
    updateSavedList({ status: LIST_STATUSES.ARCHIVED });
  }

  function discardList() {
    window.localStorage.removeItem(SAVED_SHOPPING_LIST_STORAGE_KEY);
    setSavedList(null);
    navigate("/lists");
  }

  return (
    <div className="product-detail-container">
      <div className="product-detail-header lists-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-link">Lists</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Saved</span>
        </div>

        <div className="header-top">
          <div>
            <h1 className="header-title">
              Saved <em>List</em>
            </h1>
            <p className="lists-subtitle">
              Tick purchased as you order, then received when stock lands.
            </p>
          </div>

          <Link to="/lists" className="btn-secondary lists-link-button">
            Back to lists
          </Link>
        </div>
      </div>

      <div className="lists-body">
        {!savedList ? (
          <div className="detail-section lists-empty-card">
            <span className="lists-empty-icon" aria-hidden="true">
              &#128722;
            </span>
            <h2 className="header-title">No saved shopping list</h2>
            <p className="section-empty">Save a draft shopping list to send it here.</p>
            <Link to="/lists" className="btn-primary lists-link-button">
              Create a list
            </Link>
          </div>
        ) : (
          <>
            <div className="lists-stats">
              <div className="lists-stat lists-stat-items">
                <span className="lists-stat-value">{items.length}</span>
                <span className="lists-stat-label">Items on list</span>
              </div>
              <div className="lists-stat lists-stat-units">
                <span className="lists-stat-value">{totalUnits}</span>
                <span className="lists-stat-label">Units to buy</span>
              </div>
              <div className="lists-stat lists-stat-cost">
                <span className="lists-stat-value">{currency(estimatedCost)}</span>
                <span className="lists-stat-label">Estimated cost</span>
              </div>
            </div>

            <div className="lists-layout">
              <div className="detail-section lists-card saved-list-card">
                <div className="section-title">
                  <span>Shopping list</span>
                  <span className={isArchived ? "section-badge im" : "section-badge id"}>
                    {isArchived ? "Archived" : "Saved"}
                  </span>
                  <span className="lists-progress">
                    {purchasedCount} purchased &middot; {receivedCount} received
                  </span>
                </div>

                <div className="section-content">
                  <div className="lists-toolbar">
                    <div className="lists-filters">
                      {[
                        {
                          key: FILTERS.LOW_STOCK,
                          label: "Low stock",
                          count: generated.length,
                        },
                        {
                          key: FILTERS.ALL,
                          label: "All",
                          count: items.length,
                        },
                        {
                          key: FILTERS.MANUAL,
                          label: "Added manually",
                          count: manual.length,
                        },
                      ].map(({ key, label, count }) => (
                        <button
                          key={key}
                          type="button"
                          className={
                            filter === key
                              ? "btn-secondary lists-filter is-active"
                              : "btn-secondary lists-filter"
                          }
                          onClick={() => setFilter(key)}
                        >
                          {label}
                          <span className="lists-filter-count">{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {visibleItems.length === 0 ? (
                    <p className="section-empty lists-no-match">Nothing on this filter.</p>
                  ) : (
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
                        {(filter === FILTERS.ALL ? generated : visibleItems).map((item) => (
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
                              <span className="form-tag lists-saved-qty">
                                {item.quantityWanted}
                              </span>
                            </td>
                            <td className="lists-col-check">
                              <input
                                type="checkbox"
                                checked={item.purchased}
                                onChange={() => togglePurchased(item)}
                                disabled={isArchived}
                                aria-label={`Mark ${item.productName} as purchased`}
                              />
                            </td>
                            <td className="lists-col-check">
                              <input
                                type="checkbox"
                                checked={item.received}
                                onChange={() => toggleReceived(item)}
                                disabled={isArchived || !item.purchased || !savedList.siteId}
                                aria-label={`Mark ${item.productName} as received`}
                              />
                            </td>
                          </tr>
                        ))}
                        {filter === FILTERS.ALL && manual.length > 0 && (
                          <tr className="lists-divider">
                            <td colSpan={6}>Added manually</td>
                          </tr>
                        )}
                        {filter === FILTERS.ALL && manual.map((item) => (
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
                              <span className="form-tag lists-saved-qty">
                                {item.quantityWanted}
                              </span>
                            </td>
                            <td className="lists-col-check">
                              <input
                                type="checkbox"
                                checked={item.purchased}
                                onChange={() => togglePurchased(item)}
                                disabled={isArchived}
                                aria-label={`Mark ${item.productName} as purchased`}
                              />
                            </td>
                            <td className="lists-col-check">
                              <input
                                type="checkbox"
                                checked={item.received}
                                onChange={() => toggleReceived(item)}
                                disabled={isArchived || !item.purchased || !savedList.siteId}
                                aria-label={`Mark ${item.productName} as received`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {!savedList.siteId && (
                    <p className="lists-schedule-note">
                      Choose a delivery location before receiving stock.
                    </p>
                  )}
                </div>
              </div>

              <div className="lists-sidebar">
                <div className="detail-section">
                  <div className="section-title">Actions</div>
                  <div className="section-content lists-sidebar-actions">
                    <button type="button" className="btn-print" disabled>
                      Save list
                    </button>
                    <button type="button" className="btn-secondary lists-full-btn" disabled>
                      View saved list
                    </button>
                    <button
                      type="button"
                      className="btn-primary lists-full-btn lists-archive-btn"
                      onClick={archiveList}
                      disabled={isArchived}
                    >
                      {isArchived ? "Archived" : "Archive"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary lists-full-btn"
                      onClick={() => navigate("/lists")}
                    >
                      Regenerate
                    </button>
                    <button type="button" className="btn-danger lists-full-btn" onClick={discardList}>
                      Discard list
                    </button>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-title">Delivery location</div>
                  <div className="section-content">
                    <div className="form-group">
                      <label htmlFor="saved-list-location">Received stock goes to</label>
                      <select
                        id="saved-list-location"
                        className="form-input selected"
                        value={savedList?.siteId ?? ""}
                        onChange={(event) => setListLocation(event.target.value)}
                        disabled={isArchived || hasReceivedItems}
                      >
                        <option value="">Select site&hellip;</option>
                        {locationOptions.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {hasReceivedItems && (
                      <p className="lists-schedule-note">Undo received items to change location.</p>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-title">Schedule</div>
                  <div className="section-content">
                    <div className="form-group">
                      <label htmlFor="saved-schedule-frequency">Generate every</label>
                      <select
                        id="saved-schedule-frequency"
                        className="form-input selected"
                        value={frequency}
                        onChange={(event) => setListFrequency(event.target.value)}
                        disabled={isArchived}
                      >
                        {Object.values(LIST_FREQUENCIES).map((value) => (
                          <option key={value} value={value}>
                            {LIST_FREQUENCY_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="saved-next-order-day">Next order day</label>
                      <div className="form-tag" id="saved-next-order-day">
                        {nextOrderDay(frequency)}
                      </div>
                    </div>

                    <p className="lists-schedule-note">Skeleton only, no logic wired.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
