import { NavLink } from "react-router-dom";
import "./CustomerNav.css";

/**
 * Top bar for the customer area, rendered once by CustomerLayout.
 *
 * A customer has no account and no edit rights, so none of the staff rail's
 * tools belong here - only the three ways to browse.
 */

const CUSTOMER_LINKS = [
  { to: "/customer/search", label: "Product Search" },
  { to: "/customer/lists", label: "Shopping List" },
  { to: "/customer/floor-map", label: "Floor Map" },
];

export function CustomerNav() {
  return (
    <header className="customer-nav">
      {/* The wordmark returns to the customer landing page, not to /, which
          would bounce an account-less visitor out to the staff login. */}
      <NavLink to="/customer" end className="customer-nav-logo">
        Stowed<span className="customer-nav-logo-dot">.</span>
      </NavLink>

      <nav className="customer-nav-links">
        {CUSTOMER_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `customer-nav-link${isActive ? " active" : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
