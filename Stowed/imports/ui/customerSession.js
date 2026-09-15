import { Meteor } from "meteor/meteor";

/**
 * Customer session
 *
 * A customer browses without an account, so there is no Meteor user to hang the
 * organisation off. The org code from the gateway URL (/org/:orgCode) is kept in
 * sessionStorage instead, once the gateway has confirmed it exists: it survives
 * reloads and direct URL entry, and is gone once the tab closes, which is the
 * lifetime we want for an anonymous visitor.
 *
 * The two sessions are mutually exclusive by design - a stored org code means a
 * customer, a Meteor login means staff, and never both at once. Each side is
 * cleared when the other is established: see endStaffSession below, and the
 * Accounts.onLogin hook in client/main.jsx.
 */

const CUSTOMER_ORG_KEY = "stowed.customer.orgCode";

/** Org codes are stored lowercased in the Organisations collection. */
function normalizeOrgCode(orgCode) {
  return typeof orgCode === "string" ? orgCode.trim().toLowerCase() : "";
}

export function setCustomerOrgCode(orgCode) {
  const normalized = normalizeOrgCode(orgCode);
  if (!normalized) return null;
  window.sessionStorage.setItem(CUSTOMER_ORG_KEY, normalized);
  return normalized;
}

export function getCustomerOrgCode() {
  return normalizeOrgCode(window.sessionStorage.getItem(CUSTOMER_ORG_KEY)) || null;
}

export function clearCustomerOrgCode() {
  window.sessionStorage.removeItem(CUSTOMER_ORG_KEY);
}

/**
 * Ends any Meteor login, so a customer never browses carrying staff
 * credentials. Resolves either way - a logout that fails on the server should
 * not strand the visitor on a blank page - and resolves only once the session
 * is actually gone, which callers rely on before routing to /login (that route
 * bounces a still-logged-in user straight back to /dashboard).
 */
export function endStaffSession() {
  if (!Meteor.userId()) return Promise.resolve();
  return new Promise((resolve) => Meteor.logout(() => resolve()));
}

/**
 * The full entry into the customer area, shared by the /org/:orgCode gateway
 * (QR codes) and the login page's "Continue as guest", so the two can never
 * drift: any previous organisation is dropped, any staff session is ended, and
 * the code is looked up and stored only if it exists.
 *
 * Resolves true when the visitor may go to /customer, false when the code is
 * unknown. Rejects only when the server could not be reached - the code may
 * well be fine in that case, so callers keep it separate from "not found".
 */
export async function startCustomerSession(orgCode) {
  // Dropped before the lookup, so a failed or abandoned attempt can never fall
  // back to whatever organisation an earlier visit left behind.
  clearCustomerOrgCode();

  // Logging out before the lookup, not after, so an unknown code still leaves
  // the staff session closed rather than half-abandoned.
  await endStaffSession();

  const exists = await Meteor.callAsync("organisations.exists", { orgCode: orgCode ?? "" });
  if (!exists) return false;

  setCustomerOrgCode(orgCode);
  return true;
}
