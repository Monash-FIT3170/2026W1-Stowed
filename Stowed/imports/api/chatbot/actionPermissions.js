// Single source of truth for which permission each chatbot action needs.
// These are the same permissions the app's own pages and Meteor methods enforce
// (see PERMISSIONS in userMethods.js), so the bot can never offer or run
// something the user's role couldn't do from the UI.
export const ACTION_PERMISSIONS = {
  createShoppingList: "shoppingLists.create",
  createLowStockShoppingList: "shoppingLists.create",
  createSite: "locations.manage",
  createFloorMap: "locations.manage",
  createStorageUnit: "locations.manage",
  createStorageLocation: "locations.manage",
  moveStorageUnit: "locations.manage",
  resizeStorageUnit: "locations.manage",
  assignStockToUnit: "products.adjustStock",
  openStorageUnit: "route:/locations",
  showLowStockFloorMap: "route:/floor-map",
  showFloorMapEditor: "locations.manage",
};

// Returns the permission an action type needs, or undefined for unknown types
// (callers must treat unknown as not allowed).
export function permissionForAction(type) {
  return ACTION_PERMISSIONS[type];
}
