import { createRoot } from "react-dom/client";
import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { App } from "/imports/ui/App";
import { clearCustomerOrgCode } from "/imports/ui/customerSession";
import "./main.css";

/* A staff login and a stored customer organisation are mutually exclusive. The
   customer side of that is enforced in CustomerLayout and the /org gateway;
   this is the other side, and it hangs off onLogin rather than off the login form
   so that a resumed session on page load closes the gap too. */
Accounts.onLogin(() => {
  clearCustomerOrgCode();
});

Meteor.startup(() => {
  const container = document.getElementById("react-target");
  const root = createRoot(container);
  root.render(<App />);
});
