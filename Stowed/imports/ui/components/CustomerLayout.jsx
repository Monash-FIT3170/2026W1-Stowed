import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Navigate, Outlet } from "react-router-dom";
import { useTracker } from "meteor/react-meteor-data";
import { getCustomerOrgCode, endStaffSession } from "../customerSession";
import { CustomerNav } from "./CustomerNav";
import "./CustomerLayout.css";

/**
 * Shell and gate for every customer route.
 *
 * The nav lives here rather than in each page, so it is mounted once and the
 * pages swap beneath it through the Outlet. That is what keeps the bar in place
 * when a customer clicks through to an item - a page that rendered its own nav
 * would tear the bar down and rebuild it on every navigation.
 *
 * It also enforces the two conditions the customer area assumes, since a URL
 * can be typed straight into the bar:
 *
 *  - No staff login. Arriving with one ends it and hands the visitor to /login,
 *    rather than letting a staff account browse as a customer.
 *  - An organisation. Without one there is nothing to scope the view to, so
 *    the visitor goes to /login as well; the /org/:orgCode gateway is the only
 *    way in.
 */
export function CustomerLayout() {
  // Whether a staff session was in play on arrival, read once: the logout below
  // clears it, and re-reading would flip this to false mid-flight.
  const [arrivedAsStaff] = useState(() => !!Meteor.userId());
  const userId = useTracker(() => Meteor.userId(), []);
  const orgCode = getCustomerOrgCode();

  useEffect(() => {
    if (arrivedAsStaff) endStaffSession();
  }, [arrivedAsStaff]);

  if (arrivedAsStaff) {
    // Nothing is painted until the session is actually gone: /login sends a
    // still-logged-in user back to /dashboard, which would undo the redirect.
    return userId ? null : <Navigate to="/login" replace />;
  }

  if (!orgCode) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="customer-shell">
      <CustomerNav />
      <div className="customer-content">
        <Outlet />
      </div>
    </div>
  );
}
