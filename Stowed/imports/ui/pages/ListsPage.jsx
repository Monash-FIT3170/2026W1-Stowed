import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  SHOPPING_LIST_MODES,
  LIST_FREQUENCIES,
  LIST_STATUSES,
  ADD_PRODUCT_MODES,
} from "/imports/api/shoppingLists/constants";
import { ShoppingLists } from "/imports/api/shoppingLists/collections";

// change when real data is used instead of mock
import { mockProducts, getLowStockProducts } from "/imports/api/mockProducts";
import { Sites } from "/imports/api/locations/collections";
import { toItem } from "./shoppingListHelpers";

import "./ListsPage.css";

function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export function ListsPage() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const { lists, sites } = useTracker(() => {
    Meteor.subscribe("shoppingLists");
    Meteor.subscribe("locations.all");
    return {
      lists: ShoppingLists.find({}, { sort: { createdAt: -1 } }).fetch(),
      sites: Sites.find().fetch(),
    };
  }, []);

  async function generate() {
    setIsGenerating(true);
    setGenerateError("");

    const frequency = LIST_FREQUENCIES.WEEKLY;

    try {
      const listId = await callMethod("shoppingLists.create", {
        name: `Shopping list ${lists.length + 1}`,
        mode: SHOPPING_LIST_MODES.AUTOMATED,
        frequency,
        items: getLowStockProducts(mockProducts).map((product) =>
          toItem(product, frequency, ADD_PRODUCT_MODES.GENERATED),
        ),
      });
      navigate(`/lists/${listId}`);
    } catch (error) {
      console.error("Failed to generate shopping list:", error);
      setGenerateError(error.reason || error.message || "Failed to generate list.");
    } finally {
      setIsGenerating(false);
    }
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
          Pulls every product at or below its reorder threshold. Budget is not applied.
        </p>
        {generateError && <p className="warning-text">{generateError}</p>}
      </div>

      <div className="lists-body">
        {lists.length === 0 ? (
          <div className="detail-section lists-empty-card">
            <span className="lists-empty-icon" aria-hidden="true">
              &#128722;
            </span>
            <h2 className="header-title">No active shopping lists</h2>
            <p className="section-empty">
              Generate one to pull in every product that&apos;s hit its reorder point.
            </p>
            <button type="button" className="btn-primary" onClick={generate} disabled={isGenerating}>
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
              </div>

              {lists.map((list) => {
                const site = sites.find((s) => s._id === list.siteId);
                const purchasedCount = list.items.filter((i) => i.purchased).length;
                const receivedCount = list.items.filter((i) => i.received).length;

                return (
                  <Link key={list._id} to={`/lists/${list._id}`} className="lists-overview-row">
                    <span className="item-name-link">{list.name}</span>
                    <span
                      className={
                        list.status === LIST_STATUSES.DRAFT ? "section-badge op" : "section-badge id"
                      }
                    >
                      {list.status === LIST_STATUSES.DRAFT ? "Draft" : "Saved"}
                    </span>
                    <span>{list.items.length}</span>
                    <span className="lists-overview-site">{site ? site.name : "Unassigned"}</span>
                    <span>
                      {purchasedCount}/{list.items.length}
                    </span>
                    <span>
                      {receivedCount}/{list.items.length}
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
