import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { requirePermission } from "../userMethods";
import {
  getImmersiveProduct,
  searchLensByImageUrl,
  searchShopping,
} from "../../../server/serpapi/serpapi";
import { productTitleFromLensMatches, shapeShoppingResults } from "./searchHelpers";

Meteor.methods({
  async "products.searchByText"({ query }) {
    check(query, String);
    await requirePermission(this.userId, "products.search");

    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Meteor.Error("invalid-query", "Search query cannot be empty.");

    const shoppingResults = await searchShopping(trimmedQuery);
    return shapeShoppingResults(shoppingResults, getImmersiveProduct);
  },

  async "products.searchByImage"({ imageUrl }) {
    check(imageUrl, String);
    await requirePermission(this.userId, "products.search");

    // Accept either our own relative /Uploads/... path or an already-absolute
    // URL (e.g. the debug "paste an image URL" field), since Meteor.absoluteUrl()
    // would otherwise double-prefix an already-absolute URL.
    const absoluteImageUrl = /^https?:\/\//.test(imageUrl)
      ? imageUrl
      : Meteor.absoluteUrl(imageUrl);
    const visualMatches = await searchLensByImageUrl(absoluteImageUrl);

    const productTitle = productTitleFromLensMatches(visualMatches);
    if (!productTitle) {
      throw new Meteor.Error("no-match", "Could not identify a product from that image.");
    }

    const shoppingResults = await searchShopping(productTitle);
    return shapeShoppingResults(shoppingResults, getImmersiveProduct);
  },
});
