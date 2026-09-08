/**
 * Customer session
 *
 * A customer browses without an account, so there is no Meteor user to hang the
 * organisation off. The org code from the gateway URL (/org/:orgCode) is kept in
 * sessionStorage instead, once the gateway has confirmed it exists: it survives reloads and in-tab navigation, and is gone
 * once the tab closes, which is the lifetime we want for an anonymous visitor.
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
