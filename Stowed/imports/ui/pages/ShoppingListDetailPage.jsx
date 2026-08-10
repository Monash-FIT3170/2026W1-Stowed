import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  LIST_FREQUENCIES,
  LIST_FREQUENCY_LABELS,
  LIST_STATUSES,
  ADD_PRODUCT_MODES,
} from "/imports/api/shoppingLists/constants";
import { ShoppingLists } from "/imports/api/shoppingLists/collections";

import { Products } from "/imports/api/products/collections";
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from "/imports/api/locations/collections";
import { toItem, isLowStock, nextOrderDay, currency, sortByCategory } from "./shoppingListHelpers";

import "./ListsPage.css";

const FILTERS = {
  LOW_STOCK: "lowStock",
  ALL: "all",
  MANUAL: "manual",
};

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function buildLocationLabel(location, storageUnits, floorMaps, sites) {
  const unit = storageUnits.find((item) => item._id === location.storageUnitId);
  const floorMap = unit ? floorMaps.find((item) => item._id === unit.floorMapId) : null;
  const site = floorMap ? sites.find((item) => item._id === floorMap.siteId) : null;
  return [site?.name, floorMap?.name, unit?.name, location.name, location.code]
    .filter(Boolean)
    .join(" / ");
}

export function ShoppingListDetailPage() {
  const { listId } = useParams();
  const navigate = useNavigate();

  const [filter, setFilter] = useState(FILTERS.ALL);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [allocationLocationByProductId, setAllocationLocationByProductId] = useState({});
  const [allocationError, setAllocationError] = useState("");

  const { list, sites, floorMaps, storageUnits, storageLocations, products, listsReady } =
    useTracker(() => {
      const listsSub = Meteor.subscribe("shoppingLists");
      Meteor.subscribe("locations.all");
      Meteor.subscribe("products");
      return {
        list: ShoppingLists.findOne(listId),
        sites: Sites.find().fetch(),
        floorMaps: FloorMaps.find().fetch(),
        storageUnits: StorageUnits.find().fetch(),
        storageLocations: StorageLocations.find().fetch(),
        products: Products.find({}, { sort: { name: 1 } }).fetch(),
        listsReady: listsSub.ready(),
      };
    }, [listId]);

  const locationOptions = sites.map((site) => ({ id: site._id, label: site.name }));
  const storageLocationOptions = storageLocations.map((location) => ({
    id: location._id,
    label: buildLocationLabel(location, storageUnits, floorMaps, sites),
  }));

  const items = list?.items ?? [];

  const generated = items.filter((i) => i.addMode === ADD_PRODUCT_MODES.GENERATED);
  const manual = items.filter((i) => i.addMode === ADD_PRODUCT_MODES.MANUAL);

  const visibleItems =
    filter === FILTERS.LOW_STOCK ? generated : filter === FILTERS.MANUAL ? manual : items;

  const totalUnits = items.reduce((sum, i) => sum + i.quantityWanted, 0);
  const estimatedCost = items.reduce((sum, i) => sum + i.quantityWanted * i.unitCost, 0);

  const hasReceivedItems = items.some((i) => i.received);
  const allItemsReceived = items.length > 0 && items.every((i) => i.received);
  const pendingAllocationItems = items.filter((i) => i.received && !i.allocatedLocationId);

  const isDraft = list?.status === LIST_STATUSES.DRAFT;
  const isArchived = list?.status === LIST_STATUSES.ARCHIVED;
  const isReadOnly = isArchived;

  async function updateItems(nextItems) {
    try {
      await callMethod("shoppingLists.update", { listId, items: nextItems });
    } catch (error) {
      console.error("Failed to update shopping list:", error);
    }
  }

  async function regenerate() {
    if (isReadOnly) return;
    const nextItems = products
      .filter(isLowStock)
      .map((product) =>
        toItem(product, list.frequency ?? LIST_FREQUENCIES.WEEKLY, ADD_PRODUCT_MODES.GENERATED),
      );
    await updateItems(nextItems);
    setFilter(FILTERS.ALL);
  }

  function updateQuantity(productId, rawValue) {
    if (isReadOnly) return;
    const parsed = Number.parseInt(rawValue, 10);
    const quantityWanted = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);

    updateItems(
      items.map((item) => (item.productId === productId ? { ...item, quantityWanted } : item)),
    );
  }

  function removeItem(productId) {
    if (isReadOnly) return;
    updateItems(items.filter((item) => item.productId !== productId));
    setConfirmRemoveId(null);
  }

  function addManually() {
    if (isReadOnly) return;
    const productId = addProductId || products[0]?._id;
    const product = products.find((p) => p._id === productId);
    if (!product) return;

    const quantityWanted = Math.max(1, Number(addQuantity) || 1);
    const onList = items.some((i) => i.productId === product._id);

    const nextItems = onList
      ? items.map((item) =>
          item.productId === product._id
            ? { ...item, quantityWanted: item.quantityWanted + quantityWanted }
            : item,
        )
      : [
          ...items,
          {
            ...toItem(product, list.frequency ?? LIST_FREQUENCIES.WEEKLY, ADD_PRODUCT_MODES.MANUAL),
            quantityWanted,
          },
        ];

    updateItems(nextItems);
    setAddQuantity(1);
  }

  async function save() {
    setIsSaving(true);
    setSaveError("");
    try {
      await callMethod("shoppingLists.update", { listId, status: LIST_STATUSES.SAVED });
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
    if (isReadOnly) return;
    const target = items.find((i) => i.productId === productId);
    if (!target) return;

    const nextPurchased = !target.purchased;

    if (!nextPurchased && target.received) {
      callStockMethod("products.unreceiveStock", target);
    }

    updateItems(
      items.map((item) =>
        item.productId === productId
          ? { ...item, purchased: nextPurchased, received: nextPurchased ? item.received : false }
          : item,
      ),
    );
  }

  function setListLocation(siteId) {
    if (isReadOnly) return;
    callMethod("shoppingLists.update", { listId, siteId }).catch((error) => {
      console.error("Failed to update delivery location:", error);
    });
  }

  function toggleReceived(item) {
    if (isReadOnly || !item.purchased || !list?.siteId) return;

    const nextReceived = !item.received;
    callStockMethod(nextReceived ? "products.receiveStock" : "products.unreceiveStock", item);

    updateItems(
      items.map((i) => (i.productId === item.productId ? { ...i, received: nextReceived } : i)),
    );
  }

  async function discard() {
    if (isReadOnly) return;
    try {
      await callMethod("shoppingLists.delete", { listId });
    } catch (error) {
      console.error("Failed to discard shopping list:", error);
    }
    navigate("/lists");
  }

  async function archiveList() {
    if (isDraft || isArchived) return;

    if (!allItemsReceived) {
      const shouldArchive = window.confirm(
        "Not all items have been marked received. Archive this shopping list anyway?",
      );
      if (!shouldArchive) return;
    }

    try {
      await callMethod("shoppingLists.update", {
        listId,
        status: LIST_STATUSES.ARCHIVED,
        archivedAt: new Date(),
        archivedWithPendingItems: !allItemsReceived,
      });
    } catch (error) {
      console.error("Failed to archive shopping list:", error);
    }
  }

  async function unarchiveList() {
    if (!isArchived) return;
    try {
      await callMethod("shoppingLists.update", { listId, status: LIST_STATUSES.SAVED });
    } catch (error) {
      console.error("Failed to unarchive shopping list:", error);
    }
  }

  function allocateReceivedItem(item) {
    const storageLocationId = allocationLocationByProductId[item.productId];
    if (!storageLocationId || !list?.siteId) {
      setAllocationError("Choose a storage location before assigning received stock.");
      return;
    }

    const location = storageLocationOptions.find((option) => option.id === storageLocationId);

    callMethod("products.allocateReceivedStock", {
      productId: item.productId,
      siteId: list.siteId,
      storageLocationId,
      quantity: item.quantityWanted,
    })
      .then(() => {
        setAllocationError("");
        return updateItems(
          items.map((i) =>
            i.productId === item.productId
              ? {
                  ...i,
                  allocatedLocationId: storageLocationId,
                  allocatedLocationName: location?.label ?? storageLocationId,
                  allocatedAt: new Date(),
                }
              : i,
          ),
        );
      })
      .catch((error) => {
        console.error("products.allocateReceivedStock failed:", error);
        setAllocationError(error.reason || error.message || "Failed to assign storage location.");
      });

    setAllocationLocationByProductId((current) => ({ ...current, [item.productId]: "" }));
  }

  function startEditingName() {
    setNameDraft(list.name);
    setIsEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      try {
        await callMethod("shoppingLists.rename", { listId, name: trimmed });
      } catch (error) {
        console.error("Failed to rename shopping list:", error);
      }
    }
    setIsEditingName(false);
  }

  function cancelEditingName() {
    setIsEditingName(false);
  }

  function renderRow(item) {
    return (
      <tr key={item.productId} className={item.purchased ? "lists-row-purchased" : undefined}>
        <td>
          <span className="lists-product-name">{item.productName}</span>
          <span className="lists-product-meta">
            {item.allocatedLocationName
              ? `Allocated to ${item.allocatedLocationName}`
              : `${item.brand ? `${item.brand} · ` : ""}${item.category}`}
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
            disabled={isReadOnly || item.purchased}
            aria-label={`Quantity for ${item.productName}`}
          />
        </td>

        {!isDraft && (
          <td className="lists-col-check">
            <input
              type="checkbox"
              checked={item.purchased}
              onChange={() => togglePurchased(item.productId)}
              disabled={isReadOnly || !!item.allocatedLocationId}
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
              disabled={
                isReadOnly || !!item.allocatedLocationId || !item.purchased || !list?.siteId
              }
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
              disabled={isReadOnly || item.received}
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

  if (!listsReady) {
    return (
      <div className="product-detail-container">
        <div className="lists-body">
          <p className="section-empty">Loading list&hellip;</p>
        </div>
      </div>
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
          {isEditingName ? (
            <div className="lists-name-edit">
              <input
                type="text"
                className="form-input"
                value={nameDraft}
                autoFocus
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveName();
                  if (event.key === "Escape") cancelEditingName();
                }}
                aria-label="List name"
              />
              <button type="button" className="btn-secondary" onClick={saveName}>
                Save
              </button>
              <button type="button" className="btn-secondary" onClick={cancelEditingName}>
                Cancel
              </button>
            </div>
          ) : (
            <h1 className="header-title">
              {list.name}
              <button
                type="button"
                className="lists-name-edit-btn"
                onClick={startEditingName}
                aria-label="Edit list name"
              >
                &#9998;
              </button>
            </h1>
          )}
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
          <div className="lists-main-column">
            <div className="detail-section lists-card">
              <div className="section-title">
                <span>Shopping list</span>
                <span
                  className={
                    isDraft
                      ? "section-badge op"
                      : isArchived
                        ? "section-badge im"
                        : "section-badge id"
                  }
                >
                  {isDraft ? "Draft" : isArchived ? "Archived" : "Saved"}
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

                {!isReadOnly && (
                  <div className="lists-add-row">
                    <div className="form-group lists-add-product">
                      <label htmlFor="add-product">Add a product manually</label>
                      <select
                        id="add-product"
                        className="form-input selected"
                        value={addProductId || products[0]?._id || ""}
                        onChange={(event) => setAddProductId(event.target.value)}
                      >
                        {products.map((product) => (
                          <option key={product._id} value={product._id}>
                            {product.name} ({product.totalQuantity ?? 0} in stock)
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
                )}
              </div>
            </div>

            {!isDraft && (
              <div className="detail-section lists-card">
                <div className="section-title">
                  <span>Pending allocation</span>
                  <span className="section-badge op">{pendingAllocationItems.length} waiting</span>
                </div>

                <div className="section-content">
                  {pendingAllocationItems.length === 0 ? (
                    <p className="section-empty lists-no-match">
                      No received stock waiting for a storage location.
                    </p>
                  ) : (
                    <div className="lists-allocation-list">
                      {pendingAllocationItems.map((item) => (
                        <div className="lists-allocation-row" key={item.productId}>
                          <div className="lists-allocation-product">
                            <span className="lists-product-name">{item.productName}</span>
                            <span className="lists-product-meta">
                              {item.quantityWanted} received &middot; {item.category}
                            </span>
                          </div>

                          <select
                            className="form-input selected lists-allocation-select"
                            value={allocationLocationByProductId[item.productId] ?? ""}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              setAllocationLocationByProductId((current) => ({
                                ...current,
                                [item.productId]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select storage location...</option>
                            {storageLocationOptions.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.label}
                              </option>
                            ))}
                            {storageLocationOptions.length === 0 && (
                              <option value="">No storage locations in database</option>
                            )}
                          </select>

                          <button
                            type="button"
                            className="btn-primary lists-allocation-btn"
                            onClick={() => allocateReceivedItem(item)}
                            disabled={isReadOnly}
                          >
                            Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {allocationError && <p className="lists-warning-note">{allocationError}</p>}
                </div>
              </div>
            )}
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
                {saveError && (
                  <p className="warning-text" style={{ marginTop: "8px" }}>
                    {saveError}
                  </p>
                )}
                {!isDraft && (
                  <button
                    type="button"
                    className="btn-primary lists-full-btn lists-archive-btn"
                    onClick={isArchived ? unarchiveList : archiveList}
                    title={
                      isArchived
                        ? "Move this list back to saved"
                        : allItemsReceived
                          ? "Archive this shopping list"
                          : "Archives with a warning if not all items have arrived"
                    }
                  >
                    {isArchived ? "Unarchive" : "Archive"}
                  </button>
                )}
                {!isDraft && !isArchived && !allItemsReceived && (
                  <p className="lists-warning-note">
                    {items.length - items.filter((i) => i.received).length} item
                    {items.length - items.filter((i) => i.received).length === 1 ? "" : "s"} not
                    received yet.
                  </p>
                )}
                <button
                  type="button"
                  className="btn-secondary lists-full-btn"
                  onClick={regenerate}
                  disabled={isReadOnly}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="btn-danger lists-full-btn"
                  onClick={discard}
                  disabled={isReadOnly}
                >
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
                    disabled={isReadOnly || hasReceivedItems}
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
                  <label htmlFor="schedule-frequency">Generate every</label>
                  <select
                    id="schedule-frequency"
                    className="form-input selected"
                    value={list.frequency ?? LIST_FREQUENCIES.WEEKLY}
                    disabled={isReadOnly}
                    onChange={(event) =>
                      callMethod("shoppingLists.update", {
                        listId,
                        frequency: event.target.value,
                      }).catch((error) => console.error("Failed to update frequency:", error))
                    }
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
                    {nextOrderDay(list.frequency ?? LIST_FREQUENCIES.WEEKLY)}
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
