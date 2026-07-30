import React, { useState } from "react";
import {
  SHOPPING_LIST_MODES,
  LIST_FREQUENCIES,
  LIST_FREQUENCY_LABELS,
  LIST_STATUSES,
  ADD_PRODUCT_MODES,
  FREQUENCY_WEEKS,
} from "/imports/api/shoppingLists/constants";

// change when real data is used instead of mock
import {
  mockProducts,
  getLowStockProducts,
} from "/imports/api/mockProducts";

import "./ListsPage.css";

const FILTERS = {
  LOW_STOCK: "lowStock",
  ALL: "all",
  MANUAL: "manual",
};

// change when real data is used instead of mock
function quantityFor(product, frequency) {
  const target = Math.max(
    product.reorderAt ?? 0,
    product.lowStockThreshold ?? 0,
  );
  const shortfall = target - (product.quantity ?? 0);
  return Math.max(1, shortfall) * (FREQUENCY_WEEKS[frequency] ?? 1);
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
    unitCost: product.unitCost ?? 0,
    quantityWanted:
      addMode === ADD_PRODUCT_MODES.GENERATED
        ? quantityFor(product, frequency)
        : 1,
    addMode,
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

const currency = (value) =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export function ListsPage() {
  // change when real data is used instead of mock
  const [list, setList] = useState(null);

  const [frequency, setFrequency] = useState(LIST_FREQUENCIES.WEEKLY);
  const [filter, setFilter] = useState(FILTERS.LOW_STOCK);
  const [excluded, setExcluded] = useState([]);
  const [addProductId, setAddProductId] = useState(mockProducts[0]?._id ?? "");
  const [addQuantity, setAddQuantity] = useState(1);

  const items = list?.items ?? [];
  const activeItems = items.filter((i) => !excluded.includes(i.productId));

  const generated = items.filter(
    (i) => i.addMode === ADD_PRODUCT_MODES.GENERATED,
  );
  const manual = items.filter((i) => i.addMode === ADD_PRODUCT_MODES.MANUAL);

  const visibleItems =
    filter === FILTERS.LOW_STOCK
      ? generated
      : filter === FILTERS.MANUAL
        ? manual
        : items;

  const totalUnits = activeItems.reduce((sum, i) => sum + i.quantityWanted, 0);
  const estimatedCost = activeItems.reduce(
    (sum, i) => sum + i.quantityWanted * i.unitCost,
    0,
  );

  // change when real data is used instead of mock

  function generate() {
    setList({
      mode: SHOPPING_LIST_MODES.AUTOMATED,
      frequency,
      status: LIST_STATUSES.DRAFT,
      items: getLowStockProducts(mockProducts).map((product) =>
        toItem(product, frequency, ADD_PRODUCT_MODES.GENERATED),
      ),
    });
    setExcluded([]);
    setFilter(FILTERS.LOW_STOCK);
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

  function resetQuantities() {
    setList((current) => ({
      ...current,
      items: current.items.map((item) => {
        const product = mockProducts.find((p) => p._id === item.productId);
        if (!product || item.addMode === ADD_PRODUCT_MODES.MANUAL) return item;
        return {
          ...item,
          quantityWanted: quantityFor(product, current.frequency),
        };
      }),
    }));
  }

  function toggleExcluded(productId) {
    setExcluded((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
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

  function save() {
    setList((current) => ({ ...current, status: LIST_STATUSES.SAVED }));
  }

  function discard() {
    setList(null);
    setExcluded([]);
  }

  const isDraft = list?.status === LIST_STATUSES.DRAFT;

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
          Pulls every product at or below its reorder threshold. Budget is not
          applied.
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
              Generate one to pull in every product that&apos;s hit its reorder
              point.
            </p>
            <button type="button" className="btn-primary" onClick={generate}>
              Generate shopping list
            </button>
          </div>
        ) : (
          <>
            <div className="lists-stats">
              <div className="lists-stat lists-stat-items">
                <span className="lists-stat-value">{activeItems.length}</span>
                <span className="lists-stat-label">Items on list</span>
              </div>
              <div className="lists-stat lists-stat-units">
                <span className="lists-stat-value">{totalUnits}</span>
                <span className="lists-stat-label">Units to buy</span>
              </div>
              <div className="lists-stat lists-stat-cost">
                <span className="lists-stat-value">
                  {currency(estimatedCost)}
                </span>
                <span className="lists-stat-label">Estimated cost</span>
              </div>
            </div>

            <div className="lists-layout">
              <div className="detail-section lists-card">
                <div className="section-title">
                  <span>Shopping list</span>
                  <span
                    className={isDraft ? "section-badge op" : "section-badge id"}
                  >
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
                          label: "All on list",
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

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetQuantities}
                    >
                      Reset quantities
                    </button>
                  </div>

                  {visibleItems.length === 0 ? (
                    <p className="section-empty lists-no-match">
                      Nothing on this filter.
                    </p>
                  ) : (
                    <table className="lists-table">
                      <thead>
                        <tr>
                          <th className="lists-col-check">
                            <span className="sr-only">Exclude</span>
                          </th>
                          <th>Product</th>
                          <th className="lists-col-num">In stock</th>
                          <th className="lists-col-num">Reorder at</th>
                          <th className="lists-col-num">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleItems.map((item) => {
                          const isExcluded = excluded.includes(item.productId);

                          return (
                            <tr
                              key={item.productId}
                              className={isExcluded ? "is-excluded" : undefined}
                            >
                              <td className="lists-col-check">
                                <input
                                  type="checkbox"
                                  checked={isExcluded}
                                  onChange={() => toggleExcluded(item.productId)}
                                  aria-label={`Exclude ${item.productName}`}
                                />
                              </td>

                              <td>
                                <span className="lists-product-name">
                                  {item.productName}
                                </span>
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
                                  onChange={(event) =>
                                    updateQuantity(
                                      item.productId,
                                      event.target.value,
                                    )
                                  }
                                  disabled={isExcluded}
                                  aria-label={`Quantity for ${item.productName}`}
                                />
                              </td>
                            </tr>
                          );
                        })}
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
                      disabled={!isDraft}
                    >
                      {isDraft ? "Save list" : "Saved"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary lists-full-btn"
                      onClick={generate}
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      className="btn-danger lists-full-btn"
                      onClick={discard}
                    >
                      Discard list
                    </button>
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

                    <p className="lists-schedule-note">
                      Skeleton only, no logic wired.
                    </p>
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