import "./CustomerNav.css";

/**
 * Top bar for the customer area.
 *
 * Deliberately bare for now - just the wordmark. A customer has no account and
 * no edit rights, so none of the staff rail's links belong here; the browse and
 * search controls land in this bar as the customer view is built out.
 */
export function CustomerNav() {
  return (
    <header className="customer-nav">
      <div className="customer-nav-logo">
        Stowed<span className="customer-nav-logo-dot">.</span>
      </div>
    </header>
  );
}
