import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { requirePermission } from "../userMethods";
import { searchLensByImageUrl, searchShopping } from "../../../server/serpapi/serpapi";

const MAX_RESULTS = 4;

function shapeShoppingResults(shoppingResults) {
  return shoppingResults.slice(0, MAX_RESULTS).map((result) => ({
    title: result.title,
    imageUrl: result.thumbnail,
    sellPrice: result.extracted_price,
    source: result.source,
    immersiveProductPageToken: result.immersive_product_page_token,
  }));
}

Meteor.methods({
  async "products.searchByText"({ query }) {
    check(query, String);
    await requirePermission(this.userId, "products.search");

    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Meteor.Error("invalid-query", "Search query cannot be empty.");

    const shoppingResults = await searchShopping(trimmedQuery);
    return shapeShoppingResults(shoppingResults);
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

    // Skip the first match - it's often the exact source image itself (e.g.
    // the same photo posted in a forum thread) rather than a generic product
    // listing, so the second match tends to identify the product better.
    const topMatch = visualMatches[1] || visualMatches[0];
    if (!topMatch?.title) {
      throw new Meteor.Error("no-match", "Could not identify a product from that image.");
    }

    const shoppingResults = await searchShopping(topMatch.title);
    return shapeShoppingResults(shoppingResults);
  },
});
