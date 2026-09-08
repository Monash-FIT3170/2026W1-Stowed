import { Outlet } from "react-router-dom";
import { CustomerNav } from "./CustomerNav";
import "./CustomerLayout.css";

/**
 * Shell for every customer route.
 *
 * The nav lives here rather than in each page, so it is mounted once and the
 * pages swap beneath it through the Outlet. That is what keeps the bar in place
 * when a customer clicks through to an item - a page that rendered its own nav
 * would tear the bar down and rebuild it on every navigation.
 */
export function CustomerLayout() {
  return (
    <div className="customer-shell">
      <CustomerNav />
      <div className="customer-content">
        <Outlet />
      </div>
    </div>
  );
}
