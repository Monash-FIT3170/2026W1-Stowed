import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  SHOPPING_LIST_MODES,
  LIST_FREQUENCIES,
  LIST_FREQUENCY_LABELS,
  LIST_STATUSES,
  ADD_PRODUCT_MODES,
  FREQUENCY_WEEKS,
} from "/imports/api/shoppingLists/constants";

// change when real data is used instead of mock
import { mockProducts, getLowStockProducts } from "/imports/api/mockProducts";
import { Sites } from "/imports/api/locations/collections";

import "./ListsPage.css";

const FILTERS = {
  LOW_STOCK: "lowStock",
  ALL: "all",
  MANUAL: "manual",
};

// change when real data is used instead of mock
function quantityFor(product, frequency) {
  const target = Math.max(product.reorderAt ?? 0, product.lowStockThreshold ?? 0);
  const shortfall = target - (product.quantity ?? 0);
  return Math.max(1, shortfall) * (FREQUENCY_WEEKS[frequency] ?? 1);
}

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function toItem(product, frequency, addMode) {
  return {
    productId: product._id,
    productName: product.name,
    sku: product.sku,
    category: product.category,
    inStock: product.quantity ?? 0,
    reorderAt: product.reorderAt ?? 0,
    lowStockThreshold: product.lowStockThreshold ?? 0,
    unitCost: product.purchaseCost ?? product.unitCost ?? 0,
    quantityWanted: addMode === ADD_PRODUCT_MODES.GENERATED ? quantityFor(product, frequency) : 1,
    addMode,
    purchased: false,
    received: false,
  };
}

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

const currency = (value) => value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

function sortByCategory(items) {
  return [...items].sort((a, b) => {
    const catCompare = (a.category || "Uncategorized").localeCompare(b.category || "Uncategorized");
    if (catCompare !== 0) return catCompare;
    return a.productName.localeCompare(b.productName);
  });
}

export function ListsPage() {
  // change when real data is used instead of mock
  const [list, setList] = useState(null);

  const [frequency, setFrequency] = useState(LIST_FREQUENCIES.WEEKLY);
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [addProductId, setAddProductId] = useState(mockProducts[0]?._id ?? "");
  const [addQuantity, setAddQuantity] = useState(1);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const { sites } = useTracker(() => {
    Meteor.subscribe("locations.all");
    return {
      sites: Sites.find().fetch(),
    };
  }, []);

  const locationOptions = sites.map((site) => ({ id: site._id, label: site.name }));

  const items = list?.items ?? [];

  const generated = items.filter((i) => i.addMode === ADD_PRODUCT_MODES.GENERATED);
  const manual = items.filter((i) => i.addMode === ADD_PRODUCT_MODES.MANUAL);

  const visibleItems =
    filter === FILTERS.LOW_STOCK ? generated : filter === FILTERS.MANUAL ? manual : items;

  const totalUnits = items.reduce((sum, i) => sum + i.quantityWanted, 0);
  const estimatedCost = items.reduce((sum, i) => sum + i.quantityWanted * i.unitCost, 0);

  const hasReceivedItems = items.some((i) => i.received);

  const isDraft = list?.status === LIST_STATUSES.DRAFT;

  // change when real data is used instead of mock

  function generate() {
    setList({
      mode: SHOPPING_LIST_MODES.AUTOMATED,
      frequency,
      status: LIST_STATUSES.DRAFT,
      siteId: "",
      items: getLowStockProducts(mockProducts).map((product) =>
        toItem(product, frequency, ADD_PRODUCT_MODES.GENERATED),
      ),
    });
    setFilter(FILTERS.ALL);
    setConfirmRemoveId(null);
  }

  function updateQuantity(productId, rawValue) {
    const parsed = Number.parseInt(rawValue, 10);
    const quantityWanted = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);

    setList((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.productId === productId ? { ...item, quantityWanted } : item,
      ),
    }));
  }

  function removeItem(productId) {
    setList((current) => ({
      ...current,
      items: current.items.filter((item) => item.productId !== productId),
    }));
    setConfirmRemoveId(null);
  }

  function addManually() {
    const product = mockProducts.find((p) => p._id === addProductId);
    if (!product) return;

    const quantityWanted = Math.max(1, Number(addQuantity) || 1);

    setList((current) => {
      const onList = current.items.some((i) => i.productId === product._id);

      return {
        ...current,
        items: onList
          ? current.items.map((item) =>
              item.productId === product._id
                ? {
                    ...item,
                    quantityWanted: item.quantityWanted + quantityWanted,
                  }
                : item,
            )
          : [
              ...current.items,
              {
                ...toItem(product, current.frequency, ADD_PRODUCT_MODES.MANUAL),
                quantityWanted,
              },
            ],
      };
    });

    setAddQuantity(1);
  }

  async function save() {
    setIsSaving(true);
    setSaveError("");
    try {
      await callMethod("shoppingLists.create", {
        mode: list.mode,
        frequency: list.frequency,
        items: list.items.map((item) => ({
          productId: item.productId,
          quantityWanted: item.quantityWanted,
          addMode: item.addMode,
          purchased: item.purchased,
          received: item.received,
        })),
      });
      setList((current) => ({ ...current, status: LIST_STATUSES.SAVED }));
    } catch (error) {
      console.error("Failed to save shopping list:", error);
      setSaveError(error.reason || error.message || "Failed to save list.");
    } finally {
      setIsSaving(false);
    }
  }

  function callStockMethod(methodName, item) {
    Meteor.call(
      methodName,
      { productId: item.productId, siteId: list?.siteId, quantity: item.quantityWanted },
      (error) => {
        if (error) console.error(`${methodName} failed:`, error);
      },
    );
  }

  function togglePurchased(productId) {
    setList((current) => {
      const target = current.items.find((i) => i.productId === productId);
      if (!target) return current;

      const nextPurchased = !target.purchased;

      if (!nextPurchased && target.received) {
        callStockMethod("products.unreceiveStock", target);
      }

      return {
        ...current,
        items: current.items.map((item) =>
          item.productId === productId
            ? { ...item, purchased: nextPurchased, received: nextPurchased ? item.received : false }
            : item,
        ),
      };
    });
  }

  function setListLocation(siteId) {
    setList((current) => ({ ...current, siteId }));
  }

  function toggleReceived(item) {
    if (!item.purchased || !list?.siteId) return;

    const nextReceived = !item.received;
    callStockMethod(nextReceived ? "products.receiveStock" : "products.unreceiveStock", item);

    setList((current) => ({
      ...current,
      items: current.items.map((i) =>
        i.productId === item.productId ? { ...i, received: nextReceived } : i,
      ),
    }));
  }

  function discard() {
    setList(null);
    setConfirmRemoveId(null);
  }

  function renderRow(item) {
    return (
      <tr key={item.productId} className={item.purchased ? "lists-row-purchased" : undefined}>
        <td>
          <span className="lists-product-name">{item.productName}</span>
          <span className="lists-product-meta">
            {item.sku} &middot; {item.category}
          </span>
        </td>

        <td className="lists-col-num">{item.inStock}</td>
        <td className="lists-col-num">{item.reorderAt}</td>

        <td className="lists-col-num">
          <input
            type="number"
            min="0"
            className="form-input lists-qty-input"
            value={item.quantityWanted}
            onChange={(event) => updateQuantity(item.productId, event.target.value)}
            disabled={item.purchased}
            aria-label={`Quantity for ${item.productName}`}
          />
        </td>

        {!isDraft && (
          <td className="lists-col-check">
            <input
              type="checkbox"
              checked={item.purchased}
              onChange={() => togglePurchased(item.productId)}
              aria-label={`Mark ${item.productName} as purchased`}
            />
          </td>
        )}

        {!isDraft && (
          <td className="lists-col-check">
            <input
              type="checkbox"
              checked={item.received}
              onChange={() => toggleReceived(item)}
              disabled={!item.purchased || !list?.siteId}
              aria-label={`Mark ${item.productName} as received`}
            />
          </td>
        )}

        <td className="lists-col-remove">
          {confirmRemoveId === item.productId ? (
            <span className="lists-remove-confirm">
              <button
                type="button"
                className="lists-remove-yes"
                onClick={() => removeItem(item.productId)}
              >
                Remove
              </button>
              <button
                type="button"
                className="lists-remove-no"
                onClick={() => setConfirmRemoveId(null)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="lists-remove-btn"
              onClick={() => setConfirmRemoveId(item.productId)}
              disabled={item.received}
              title={item.received ? "Undo received before removing" : undefined}
              aria-label={`Remove ${item.productName} from the list`}
            >
              &times;
            </button>
          )}
        </td>
      </tr>
    );
  }

  function renderCategoryGroupedRows(groupItems) {
    const sorted = sortByCategory(groupItems);
    const rows = [];
    let lastCategory = null;

    sorted.forEach((item) => {
      const cat = item.category || "Uncategorized";
      if (cat !== lastCategory) {
        rows.push(
          <tr key={`divider-${cat}`} className="lists-divider">
            <td colSpan={isDraft ? 5 : 7}>{cat}</td>
          </tr>,
        );
        lastCategory = cat;
      }
      rows.push(renderRow(item));
    });

    return rows;
  }

  function renderGroup(groupItems) {
    return groupByCategory
      ? renderCategoryGroupedRows(groupItems)
      : sortByCategory(groupItems).map(renderRow);
  }

  return (
    <div className="product-detail-container">
      <div className="product-detail-header lists-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Lists</span>
        </div>

        <div className="header-top">
          <h1 className="header-title">
            Shopping <em>Lists</em>
          </h1>

          <button type="button" className="btn-primary" onClick={generate}>
            + Generate shopping list
          </button>
        </div>

        <p className="lists-subtitle">
          Pulls every product at or below its reorder threshold. Budget is not applied.
        </p>
      </div>

      <div className="lists-body">
        {list === null ? (
          <div className="detail-section lists-empty-card">
            <span className="lists-empty-icon" aria-hidden="true">
              &#128722;
            </span>
            <h2 className="header-title">No active shopping list</h2>
            <p className="section-empty">
              Generate one to pull in every product that&apos;s hit its reorder point.
            </p>
            <button type="button" className="btn-primary" onClick={generate}>
              Generate shopping list
            </button>
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
              <div className="detail-section lists-card">
                <div className="section-title">
                  <span>Shopping list</span>
                  <span className={isDraft ? "section-badge op" : "section-badge id"}>
                    {isDraft ? "Draft" : "Saved"}
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
                          onClick={() => {
                            setFilter(key);
                            setConfirmRemoveId(null);
                          }}
                        >
                          {label}
                          <span className="lists-filter-count">{count}</span>
                        </button>
                      ))}

                      <button
                        type="button"
                        className={
                          groupByCategory
                            ? "btn-secondary lists-filter is-active"
                            : "btn-secondary lists-filter"
                        }
                        onClick={() => setGroupByCategory((v) => !v)}
                      >
                        Categorised
                      </button>
                    </div>
                  </div>

                  {visibleItems.length === 0 ? (
                    <p className="section-empty lists-no-match">
                      {items.length === 0
                        ? "Every item has been removed. Add one below or regenerate."
                        : "Nothing on this filter."}
                    </p>
                  ) : (
                    <table className="lists-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="lists-col-num">In stock</th>
                          <th className="lists-col-num">Reorder at</th>
                          <th className="lists-col-num">Qty</th>
                          {!isDraft && <th className="lists-col-check">Purchased</th>}
                          {!isDraft && <th className="lists-col-check">Received</th>}
                          <th className="lists-col-remove">
                            <span className="lists-visually-hidden">Remove</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filter === FILTERS.ALL ? (
                          <>
                            {renderGroup(generated)}
                            {manual.length > 0 && (
                              <tr className="lists-divider">
                                <td colSpan={isDraft ? 5 : 7}>Added manually</td>
                              </tr>
                            )}
                            {renderGroup(manual)}
                          </>
                        ) : (
                          renderGroup(visibleItems)
                        )}
                      </tbody>
                    </table>
                  )}

                  <div className="lists-add-row">
                    <div className="form-group lists-add-product">
                      <label htmlFor="add-product">Add a product manually</label>
                      <select
                        id="add-product"
                        className="form-input selected"
                        value={addProductId}
                        onChange={(event) => setAddProductId(event.target.value)}
                      >
                        {mockProducts.map((product) => (
                          <option key={product._id} value={product._id}>
                            {product.name} ({product.quantity} in stock)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group lists-add-qty">
                      <label htmlFor="add-qty">Qty wanted</label>
                      <input
                        id="add-qty"
                        type="number"
                        min="1"
                        className="form-input"
                        value={addQuantity}
                        onChange={(event) => setAddQuantity(event.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-secondary lists-add-btn"
                      onClick={addManually}
                    >
                      Add to list
                    </button>
                  </div>
                </div>
              </div>

              <div className="lists-sidebar">
                <div className="detail-section">
                  <div className="section-title">Actions</div>
                  <div className="section-content lists-sidebar-actions">
                    <button
                      type="button"
                      className="btn-print"
                      onClick={save}
                      disabled={!isDraft || isSaving}
                    >
                      {isSaving ? "Saving..." : isDraft ? "Save list" : "Saved"}
                    </button>
                    {saveError && <p className="warning-text" style={{ marginTop: "8px" }}>{saveError}</p>}
                    <button
                      type="button"
                      className="btn-secondary lists-full-btn"
                      onClick={generate}
                    >
                      Regenerate
                    </button>
                    <button type="button" className="btn-danger lists-full-btn" onClick={discard}>
                      Discard list
                    </button>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-title">Delivery location</div>
                  <div className="section-content">
                    <div className="form-group">
                      <label htmlFor="list-location">Received stock goes to</label>
                      <select
                        id="list-location"
                        className="form-input selected"
                        value={list?.siteId ?? ""}
                        onChange={(event) => setListLocation(event.target.value)}
                        disabled={hasReceivedItems}
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

                {/* change when real data is used instead of mock */}
                <div className="detail-section">
                  <div className="section-title">Schedule</div>
                  <div className="section-content">
                    <div className="form-group">
                      <label htmlFor="schedule-frequency">Generate every</label>
                      <select
                        id="schedule-frequency"
                        className="form-input selected"
                        value={frequency}
                        onChange={(event) => setFrequency(event.target.value)}
                      >
                        {Object.values(LIST_FREQUENCIES).map((value) => (
                          <option key={value} value={value}>
                            {LIST_FREQUENCY_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="next-order-day">Next order day</label>
                      <div className="form-tag" id="next-order-day">
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