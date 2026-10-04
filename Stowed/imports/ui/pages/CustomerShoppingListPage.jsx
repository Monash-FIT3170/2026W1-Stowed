import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Link } from "react-router-dom";
import { getCustomerOrgCode } from "../customerSession";
import { getShoppingList, pruneShoppingList } from "../customerShoppingList";
import { ProductThumbnail } from "../components/ProductThumbnail";
import "../Global.css";
import "./CustomerShoppingListPage.css";

/**
 * SHOPPING LIST
 * The shopper's own list. Only { productId, quantity } is held in the session
 * (see customerShoppingList); the products themselves are fetched here through
 * the same whitelisted customer catalogue the search page uses, so a name,
 * price or location that moved is never shown stale out of the tab.
 *
 * TODO for team:
 *  - Add items to the list from search and the product view
 *  - Change quantity and remove items from this page
 *  - Point "More info" at a read-only product view
 */

export function CustomerShoppingListPage() {
  const orgCode = getCustomerOrgCode();

  // Entries drive the rows; the catalogue is what they are joined against.
  const [entries, setEntries] = useState(() => getShoppingList());
  const [reloadCount, setReloadCount] = useState(0);

  // An empty list needs no catalogue, so the empty state shows at once rather
  // than after a round trip. Going from empty to non-empty flips this and
  // fetches; adding a second item does not, since the catalogue already has it.
  const needsCatalogue = entries.length > 0;

  // The fetch is held with the request it answered, so the outcome is derived
  // rather than reset by an effect on every change.
  const requestKey = `${orgCode}:${reloadCount}:${needsCatalogue}`;
  const [fetched, setFetched] = useState({ key: null, status: "loading", byId: null });
  const answered = fetched.key === requestKey;

  const loadState = !needsCatalogue ? "ready" : answered ? fetched.status : "loading";
  const productsById = answered ? fetched.byId : null;

  useEffect(() => {
    if (!needsCatalogue) return undefined;

    let current = true;
    Meteor.callAsync("customer.products.list", { orgCode })
      .then((products) => {
        if (!current) return;
        const byId = new Map(products.map((product) => [product._id, product]));

        // A product the store has since deleted is dropped from the session
        // too, so the list heals instead of showing a permanent gap.
        const kept = pruneShoppingList(new Set(byId.keys()));
        setEntries((previous) => (kept.length === previous.length ? previous : kept));
        setFetched({ key: requestKey, status: "ready", byId });
      })
      .catch(() => {
        if (current) setFetched({ key: requestKey, status: "error", byId: null });
      });

    return () => {
      current = false;
    };
  }, [requestKey, orgCode, needsCatalogue]);

  const items = productsById
    ? entries
        .map((entry) => ({ entry, product: productsById.get(entry.productId) }))
        .filter(({ product }) => product)
    : [];

  return (
    <div className="customer-page">
      <h1 className="customer-page-title">Shopping List</h1>

      <div className="shopping-list">
        {loadState === "loading" && <div className="empty-state">Loading your list...</div>}

        {loadState === "error" && (
          <div className="empty-state">
            <p>We couldn&apos;t load your list.</p>
            <p>Your items are still saved. Try again in a moment.</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setReloadCount((count) => count + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {loadState === "ready" && items.length === 0 && (
          /* The heading row goes too - column headings with no columns under
             them read as a broken table rather than an empty one. */
          <div className="empty-state">
            <p>Your shopping list is empty.</p>
            <p>Add items while you browse and they will show up here.</p>
            <Link to="/customer/search" className="btn-secondary">
              Browse products
            </Link>
          </div>
        )}

        {loadState === "ready" && items.length > 0 && (
          <>
            {/* Not a <table>: the rows fold into cards on a phone, which a table
                cannot do without losing its own semantics anyway. Matches how
                the staff inventory list is built. */}
            <div className="shopping-list-header">
              <span />
              <span>Item</span>
              <span>Qty</span>
              <span>Location</span>
              <span />
            </div>

            {items.map(({ entry, product }) => {
              const [first, ...rest] = product.locations;
              const locationLabel = first ? first.label : "-";

              return (
                <div key={product._id} className="shopping-list-row">
                  <span className="shopping-list-thumb">
                    <ProductThumbnail images={product.images} name={product.name} />
                  </span>
                  <span className="shopping-list-name">{product.name}</span>
                  <span className="shopping-list-quantity">x {entry.quantity}</span>
                  <span className="shopping-list-location">
                    {locationLabel}
                    {rest.length > 0 && (
                      <span className="shopping-list-location-more"> +{rest.length} more</span>
                    )}
                  </span>
                  {/* Phone only - the quantity and location columns as one line. */}
                  <span className="shopping-list-meta">
                    x {entry.quantity}
                    {first ? ` at ${first.label}` : ""}
                  </span>
                  {/* Not wired yet. */}
                  <button type="button" className="shopping-list-more">
                    More info
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
