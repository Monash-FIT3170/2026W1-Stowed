import React, { useState } from "react";
import {
  SHOPPING_LIST_MODES,
  LIST_FREQUENCIES,
  LIST_FREQUENCY_LABELS,
  LIST_STATUSES,
  ADD_PRODUCT_MODES,
} from "/imports/api/shoppingLists/constants";
import "./ListsPage.css";

/**
 * Products a generated list would come back with.
 * TODO: replace with the result of the generate method, which reads current
 * stock against each product's reorderAt.
 */
const MOCK_GENERATED_ITEMS = [
  {
    productId: "mock-product-1",
    productName: "Hex bolts M8 x 50mm",
    quantityWanted: 21,
    addMode: ADD_PRODUCT_MODES.GENERATED,
  },
  {
    productId: "mock-product-2",
    productName: "LED bulbs E27 warm",
    quantityWanted: 13,
    addMode: ADD_PRODUCT_MODES.GENERATED,
  },
  {
    productId: "mock-product-3",
    productName: "Garden hose 15m",
    quantityWanted: 5,
    addMode: ADD_PRODUCT_MODES.GENERATED,
  },
];

export function ListsPage() {
  // No list until the user generates one or starts one by hand.
  // TODO: replace with useTracker on the shoppingLists publication.
  const [list, setList] = useState(null);
  const [frequency, setFrequency] = useState(LIST_FREQUENCIES.WEEKLY);

  const isAutomated = list?.mode === SHOPPING_LIST_MODES.AUTOMATED;

  // TODO: call the generate method instead of building this client side
  function handleGenerate() {
    setList({
      mode: SHOPPING_LIST_MODES.AUTOMATED,
      frequency,
      status: LIST_STATUSES.DRAFT,
      items: MOCK_GENERATED_ITEMS,
    });
  }

  // TODO: call the insert method
  function handleStartManual() {
    setList({
      mode: SHOPPING_LIST_MODES.MANUAL,
      status: LIST_STATUSES.DRAFT,
      items: [],
    });
  }

  // TODO: call the save method
  function handleSave() {
    setList({ ...list, status: LIST_STATUSES.SAVED });
  }

  function handleDiscard() {
    setList(null);
  }

  return (
    <div className="product-detail-container">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Lists</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Shopping <em>Lists</em></h1>
        </div>
      </div>

      <div className="lists-lofi">
        {list === null ? (
          <div className="lofi-block">
            <p className="lofi-empty">
              No shopping list yet. Generate one from current stock, or start an
              empty list and add products by hand.
            </p>

            <div className="lofi-row lofi-row-baseline">
              <label className="lofi-inline-label" htmlFor="list-frequency">
                Every
              </label>
              <select
                id="list-frequency"
                className="lofi-select"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value)}
              >
                {Object.values(LIST_FREQUENCIES).map((value) => (
                  <option key={value} value={value}>
                    {LIST_FREQUENCY_LABELS[value]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="lofi-btn"
                onClick={handleGenerate}
              >
                Generate list
              </button>
              <button
                type="button"
                className="lofi-btn"
                onClick={handleStartManual}
              >
                Add manually
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="lofi-bar">
              <div className="lofi-bar-left">
                <span className="lofi-value">
                  {isAutomated
                    ? `Automated \u00b7 ${LIST_FREQUENCY_LABELS[list.frequency]}`
                    : "Manual"}
                </span>
              </div>

              <span className="lofi-status">
                {list.status === LIST_STATUSES.DRAFT ? "Draft" : "Saved"}
              </span>
            </div>

            <div className="lofi-block">
              <span className="lofi-label">
                Products ({list.items.length})
              </span>

              {list.items.length === 0 ? (
                <p className="lofi-empty">
                  Nothing on this list yet. Add a product to get started.
                </p>
              ) : (
                <table className="lofi-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td>{item.quantityWanted}</td>
                        <td>
                          {item.addMode === ADD_PRODUCT_MODES.GENERATED
                            ? "auto"
                            : "manual"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="lofi-block">
              <span className="lofi-label">Actions</span>
              <div className="lofi-row">
                {/* TODO: open a product picker */}
                <button type="button" className="lofi-btn">
                  Add product
                </button>
                <button
                  type="button"
                  className="lofi-btn"
                  onClick={handleSave}
                  disabled={list.status === LIST_STATUSES.SAVED}
                >
                  Save list
                </button>
                <button
                  type="button"
                  className="lofi-btn"
                  onClick={handleDiscard}
                >
                  Discard
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}