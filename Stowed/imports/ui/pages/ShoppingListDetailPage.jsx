import { useState, useSyncExternalStore } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  LIST_FREQUENCIES,
  LIST_FREQUENCY_LABELS,
  LIST_STATUSES,
  ADD_PRODUCT_MODES,
} from "/imports/api/shoppingLists/constants";

// change when real data is used instead of mock
import { mockProducts, getLowStockProducts } from "/imports/api/mockProducts";
import { Sites } from "/imports/api/locations/collections";
import {
  getLists,
  subscribeLists,
  updateList,
  removeList,
} from "/imports/api/shoppingLists/mockListsStore";
import { toItem, nextOrderDay, currency } from "./shoppingListHelpers";

import "./ListsPage.css";
import "../Global.css";

const FILTERS = {
  LOW_STOCK: "lowStock",
  ALL: "all",
  MANUAL: "manual",
};

export function ShoppingListDetailPage() {
  const { listId } = useParams();
  const navigate = useNavigate();

  // change when real data is used instead of mock
  const lists = useSyncExternalStore(subscribeLists, getLists);
  const list = lists.find((l) => l.id === listId) ?? null;

  const [frequency, setFrequency] = useState(list?.frequency ?? LIST_FREQUENCIES.WEEKLY);
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [addProductId, setAddProductId] = useState(mockProducts[0]?._id ?? "");
  const [addQuantity, setAddQuantity] = useState(1);

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

  function regenerate() {
    updateList(listId, (current) => ({
      ...current,
      items: getLowStockProducts(mockProducts).map((product) =>
        toItem(product, current.frequency, ADD_PRODUCT_MODES.GENERATED),
      ),
    }));
    setFilter(FILTERS.ALL);
  }

  function updateQuantity(productId, rawValue) {
    const parsed = Number.parseInt(rawValue, 10);
    const quantityWanted = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);

    updateList(listId, (current) => ({
      ...current,
      items: current.items.map((item) =>
        item.productId === productId ? { ...item, quantityWanted } : item,
      ),
    }));
  }

  function addManually() {
    const product = mockProducts.find((p) => p._id === addProductId);
    if (!product) return;

    const quantityWanted = Math.max(1, Number(addQuantity) || 1);

    updateList(listId, (current) => {
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
    updateList(listId, (current) => ({ ...current, status: LIST_STATUSES.SAVED }));
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
    updateList(listId, (current) => {
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
    updateList(listId, (current) => ({ ...current, siteId }));
  }

  function toggleReceived(item) {
    if (!item.purchased || !list?.siteId) return;

    const nextReceived = !item.received;
    callStockMethod(nextReceived ? "products.receiveStock" : "products.unreceiveStock", item);

    updateList(listId, (current) => ({
      ...current,
      items: current.items.map((i) =>
        i.productId === item.productId ? { ...i, received: nextReceived } : i,
      ),
    }));
  }

  function discard() {
    removeList(listId);
    navigate("/lists");
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
      </tr>
    );
  }

  if (!list) {
    return (
      <div className="product-detail-container">
        <div className="product-detail-header lists-header">
          <div className="breadcrumb">
            <Link to="/lists" className="breadcrumb-link">
              Lists
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Not found</span>
          </div>
          <h1 className="header-title">List not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-container">
      <div className="product-detail-header lists-header">
        <div className="breadcrumb">
          <Link to="/lists" className="breadcrumb-link">
            Lists
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{list.name}</span>
        </div>

        <div className="header-top">
          <h1 className="header-title">{list.name}</h1>
        </div>
      </div>

      <div className="lists-body">
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
                      {!isDraft && <th className="lists-col-check">Purchased</th>}
                      {!isDraft && <th className="lists-col-check">Received</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filter === FILTERS.ALL ? (
                      <>
                        {generated.map(renderRow)}
                        {manual.length > 0 && (
                          <tr className="lists-divider">
                            <td colSpan={isDraft ? 4 : 6}>Added manually</td>
                          </tr>
                        )}
                        {manual.map(renderRow)}
                      </>
                    ) : (
                      visibleItems.map(renderRow)
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

                <button type="button" className="btn-secondary lists-add-btn" onClick={addManually}>
                  Add to list
                </button>
              </div>
            </div>
          </div>

          <div className="lists-sidebar">
            <div className="detail-section">
              <div className="section-title">Actions</div>
              <div className="section-content lists-sidebar-actions">
                <button type="button" className="btn-print" onClick={save} disabled={!isDraft}>
                  {isDraft ? "Save list" : "Saved"}
                </button>
                <button type="button" className="btn-secondary lists-full-btn" onClick={regenerate}>
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
      </div>
    </div>
  );
}
