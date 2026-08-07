import { useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import {
  SHOPPING_LIST_MODES,
  LIST_FREQUENCIES,
  LIST_STATUSES,
  ADD_PRODUCT_MODES,
} from "/imports/api/shoppingLists/constants";

// change when real data is used instead of mock
import { mockProducts, getLowStockProducts } from "/imports/api/mockProducts";
import { Sites } from "/imports/api/locations/collections";
import { getLists, addList, subscribeLists } from "/imports/api/shoppingLists/mockListsStore";
import { toItem } from "./shoppingListHelpers";

import "./ListsPage.css";
import "./InventoryListPage.css";
import "../Global.css";

export function ListsPage() {
  const navigate = useNavigate();

  // change when real data is used instead of mock (should be all active shopping lists from the db)
  const lists = useSyncExternalStore(subscribeLists, getLists);

  const { sites } = useTracker(() => {
    Meteor.subscribe("locations.all");
    return {
      sites: Sites.find().fetch(),
    };
  }, []);

  function generate() {
    const id = `list-${Date.now()}`;
    const frequency = LIST_FREQUENCIES.WEEKLY;

    addList({
      id,
      name: `Shopping list ${lists.length + 1}`,
      mode: SHOPPING_LIST_MODES.AUTOMATED,
      frequency,
      status: LIST_STATUSES.DRAFT,
      siteId: "",
      items: getLowStockProducts(mockProducts).map((product) =>
        toItem(product, frequency, ADD_PRODUCT_MODES.GENERATED),
      ),
    });

    navigate(`/lists/${id}`);
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

          <div className="lists-header-actions">
            {/* does nothing yet */}
            <button type="button" className="btn-secondary" onClick={() => {}}>
              Archived lists
            </button>
            <button type="button" className="btn-primary" onClick={generate}>
              + Generate shopping list
            </button>
          </div>
        </div>

        <p className="lists-subtitle">
          Pulls every product at or below its reorder threshold. Budget is not applied.
        </p>
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
            <button type="button" className="btn-primary" onClick={generate}>
              Generate shopping list
            </button>
          </div>
        ) : (
          <div className="detail-section">
            <div style={{ padding: "16px 20px 0", marginBottom: "8px" }}>
              <div className="recent-items-title">Active lists</div>
              <div className="recent-items-subtitle">
                {lists.length} shopping list{lists.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="lists-overview-header">
              <span>Name</span>
              <span>Items</span>
              <span>Site</span>
              <span>Purchased</span>
              <span>Received</span>
            </div>

            {lists.map((l) => {
              const site = sites.find((s) => s._id === l.siteId);
              const purchasedCount = l.items.filter((i) => i.purchased).length;
              const receivedCount = l.items.filter((i) => i.received).length;

              return (
                <Link key={l.id} to={`/lists/${l.id}`} className="lists-overview-row">
                  <span className="item-name-link">{l.name}</span>
                  <span>{l.items.length}</span>
                  <span className="lists-overview-site">{site ? site.name : "Unassigned"}</span>
                  <span>
                    {purchasedCount}/{l.items.length}
                  </span>
                  <span>
                    {receivedCount}/{l.items.length}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
