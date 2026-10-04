import "../Global.css";
import "./CustomerShoppingListPage.css";
import { ProductThumbnail } from "../components/ProductThumbnail";

/**
 * SHOPPING LIST
 * A customer's own shopping list, held for the browser session rather than an
 * account.
 *
 * Skeleton only: the rows below are hard-coded samples so the format can be
 * judged, and the "More info" buttons do nothing yet.
 *
 * TODO for team:
 *  - Replace PLACEHOLDER_ITEMS with the customer's real list
 *  - Let a customer collect items into a list without an account, and persist
 *    it for the session alongside the organisation code
 *  - Point "More info" at a read-only product view
 *  - Decide the empty state for a list with nothing in it yet
 */

/* Sample rows, not data. Deliberately varied - a long name, a one-word name, a
   missing location - so the layout is judged against awkward content rather
   than tidy content. */
const PLACEHOLDER_ITEMS = [
  { _id: "1", name: "Wholemeal Sandwich Bread 700g", quantity: 2, location: "Aisle 3 - Bakery" },
  { _id: "2", name: "Milk", quantity: 1, location: "Aisle 1 - Dairy" },
  { _id: "3", name: "Free Range Eggs (12 pack)", quantity: 1, location: "Aisle 1 - Dairy" },
  { _id: "4", name: "Tomato Passata", quantity: 3, location: null },
];

export function CustomerShoppingListPage() {
  return (
    <div className="customer-page">
      <h1 className="customer-page-title">Shopping List</h1>

      <div className="shopping-list">
        {/* Not a <table>: the rows fold into cards on a phone, which a table
            cannot do without losing its own semantics anyway. Matches how the
            staff inventory list is built. */}
        <div className="shopping-list-header">
          <span />
          <span>Item</span>
          <span>Qty</span>
          <span>Location</span>
          <span />
        </div>

        {PLACEHOLDER_ITEMS.map((item) => (
          <div key={item._id} className="shopping-list-row">
            <span className="shopping-list-thumb">
              <ProductThumbnail name={item.name} />
            </span>
            <span className="shopping-list-name">{item.name}</span>
            <span className="shopping-list-quantity">x {item.quantity}</span>
            <span className="shopping-list-location">{item.location ?? "-"}</span>
            {/* Phone only - the quantity and location columns as one line. */}
            <span className="shopping-list-meta">
              x {item.quantity}
              {item.location ? ` at ${item.location}` : ""}
            </span>
            {/* Not wired yet. */}
            <button type="button" className="shopping-list-more">
              More info
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
