import "../Global.css";
import "./CustomerPage.css";
import { CustomerNav } from "../components/CustomerNav";

/**
 * CUSTOMER
 * Read-only storefront view for a customer browsing without an account. The
 * organisation is set by the /org/:orgCode gateway and read from the customer
 * session.
 *
 * TODO for team:
 *  - Publish org-scoped products for anonymous clients (read-only)
 *  - List and search items, with no create/edit/delete affordances
 *  - Fill out CustomerNav with the browse and search controls
 */

export function CustomerPage() {
  return (
    <div className="customer-page">
      <CustomerNav />
    </div>
  );
}
