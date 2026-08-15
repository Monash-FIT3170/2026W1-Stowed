import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  SHOPPING_LIST_MODES,
  LIST_FREQUENCIES,
  LIST_STATUSES,
  BUDGET_STRATEGIES,
  BUDGET_STRATEGY_LABELS,
} from "/imports/api/shoppingLists/constants";
import { ShoppingLists } from "/imports/api/shoppingLists/collections";

import { Products } from "/imports/api/products/collections";
import { Sites } from "/imports/api/locations/collections";
import {
  allocateWithinBudget,
  isLowStock,
  toCents,
  fromCents,
  currency,
} from "./shoppingListHelpers";

import "./ListsPage.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

const STATUS_LABELS = {
  [LIST_STATUSES.DRAFT]: "Draft",
  [LIST_STATUSES.SAVED]: "Saved",
  [LIST_STATUSES.ARCHIVED]: "Archived",
};

function statusBadgeClass(status) {
  if (status === LIST_STATUSES.DRAFT) return "section-badge op";
  if (status === LIST_STATUSES.ARCHIVED) return "section-badge im";
  return "section-badge id";
}

export function ListsPage() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [showEmptyNotice, setShowEmptyNotice] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [strategy, setStrategy] = useState(BUDGET_STRATEGIES.MAX_PRODUCTS);

  const { lists, sites, products } = useTracker(() => {
    Meteor.subscribe("shoppingLists");
    Meteor.subscribe("locations.all");
    Meteor.subscribe("products");
    return {
      lists: ShoppingLists.find({}, { sort: { createdAt: -1 } }).fetch(),
      sites: Sites.find().fetch(),
      products: Products.find({}, { sort: { name: 1 } }).fetch(),
    };
  }, []);

  const lowStock = products.filter(isLowStock);

  // null means no budget. An empty, negative or unparseable input is treated
  // as no budget; a deliberate 0 is a real budget that only free items fit.
  const budgetCents = useMemo(() => {
    const trimmed = budgetInput.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return toCents(parsed);
  }, [budgetInput]);

  const preview = allocateWithinBudget(lowStock, {
    frequency: LIST_FREQUENCIES.WEEKLY,
    strategy,
    budgetCents,
  });

  let previewText;
  if (lowStock.length === 0) {
    previewText = "No low stock products right now.";
  } else if (budgetCents === null) {
    previewText = `${lowStock.length} low stock products, ${currency(
      fromCents(preview.spentCents),
    )} estimated.`;
  } else {
    previewText = `${preview.items.length} of ${lowStock.length} products fit. Spending ${currency(
      fromCents(preview.spentCents),
    )}, ${currency(fromCents(preview.remainingCents))} unspent.`;
  }

  async function createList(items) {
    setIsGenerating(true);
    setGenerateError("");
    setShowEmptyNotice(false);

    try {
      const listId = await callMethod("shoppingLists.create", {
        name: `Shopping list ${lists.length + 1}`,
        mode: SHOPPING_LIST_MODES.AUTOMATED,
        frequency: LIST_FREQUENCIES.WEEKLY,
        items,
      });
      navigate(`/lists/${listId}`);
    } catch (error) {
      console.error("Failed to generate shopping list:", error);
      setGenerateError(error.reason || error.message || "Failed to generate list.");
    }
    setIsGenerating(false);
  }

  function generate() {
    if (preview.items.length === 0) {
      setShowEmptyNotice(true);
      return;
    }

    createList(preview.items);
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

          <button type="button" className="btn-primary" onClick={generate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "+ Generate shopping list"}
          </button>
        </div>

        <p className="lists-subtitle">
          Pulls every product at or below its reorder threshold. Leave the budget blank to include
          everything.
        </p>

        <div className="lists-budget-row">
          <div className="form-group lists-budget-amount">
            <label htmlFor="list-budget">Budget (optional)</label>
            <input
              id="list-budget"
              type="number"
              min="0"
              step="0.01"
              className="form-input"
              placeholder="No limit"
              value={budgetInput}
              onChange={(event) => {
                setBudgetInput(event.target.value);
                setShowEmptyNotice(false);
              }}
            />
          </div>

          {budgetCents !== null && (
            <div className="form-group lists-budget-strategy">
              <label htmlFor="list-strategy">Allocation strategy</label>
              <select
                id="list-strategy"
                className="form-input selected"
                value={strategy}
                onChange={(event) => {
                  setStrategy(event.target.value);
                  setShowEmptyNotice(false);
                }}
              >
                {Object.values(BUDGET_STRATEGIES).map((value) => (
                  <option key={value} value={value}>
                    {BUDGET_STRATEGY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <p className="lists-preview">{previewText}</p>

        {preview.skipped.length > 0 && (
          <p className="warning-text lists-preview-skipped">
            {preview.skipped.length} {preview.skipped.length === 1 ? "product does" : "products do"}{" "}
            not fit: {preview.skipped.map((product) => product.name).join(", ")}
          </p>
        )}

        {generateError && <p className="warning-text">{generateError}</p>}
      </div>

      <div className="lists-body">
        {showEmptyNotice && (
          <div className="lists-empty-warning">
            <p className="lists-empty-warning-text">
              {lowStock.length === 0
                ? "No low stock products found. Every product is either above its reorder point or has no reorder point set."
                : `Nothing fits this budget. The cheapest of the ${lowStock.length} low stock products costs more than ${currency(fromCents(budgetCents ?? 0))}.`}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => createList([])}
              disabled={isGenerating}
            >
              Continue with empty shopping list
            </button>
          </div>
        )}
        {lists.length === 0 ? (
          <div className="detail-section lists-empty-card">
            <span className="lists-empty-icon" aria-hidden="true">
              &#128722;
            </span>
            <h2 className="header-title">No active shopping lists</h2>
            <p className="section-empty">
              Generate one to pull in every product that&apos;s hit its reorder point.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={generate}
              disabled={isGenerating}
            >
              Generate shopping list
            </button>
          </div>
        ) : (
          <div className="detail-section">
            <div className="section-title">
              <span>Active lists</span>
              <span className="section-badge id">{lists.length}</span>
            </div>

            <div className="section-content">
              <div className="lists-overview-header">
                <span>Name</span>
                <span>Status</span>
                <span>Items</span>
                <span>Site</span>
                <span>Purchased</span>
                <span>Received</span>
                <span>Allocated</span>
              </div>

              {lists.map((list) => {
                const site = sites.find((s) => s._id === list.siteId);
                const purchasedCount = list.items.filter((i) => i.purchased).length;
                const receivedCount = list.items.filter((i) => i.received).length;
                const allocatedCount = list.items.filter(
                  (i) => i.received && i.allocatedLocationId,
                ).length;
                const pendingAllocation = list.items.filter(
                  (i) => i.received && !i.allocatedLocationId,
                ).length;

                return (
                  <Link key={list._id} to={`/lists/${list._id}`} className="lists-overview-row">
                    <span className="item-name-link">{list.name}</span>
                    <span className={statusBadgeClass(list.status)}>
                      {STATUS_LABELS[list.status] ?? list.status}
                    </span>
                    <span>{list.items.length}</span>
                    <span className="lists-overview-site">{site ? site.name : "Unassigned"}</span>
                    <span>
                      {purchasedCount}/{list.items.length}
                    </span>
                    <span>
                      {receivedCount}/{list.items.length}
                    </span>
                    <span className="lists-allocation-cell">
                      {receivedCount > 0 ? `${allocatedCount}/${receivedCount}` : "—"}
                      {pendingAllocation > 0 && (
                        <span className="section-badge op">{pendingAllocation} waiting</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
