import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { requirePermission } from "../userMethods";
import {
  getImmersiveProduct,
  searchLensByImageUrl,
  searchShopping,
} from "../../../server/serpapi/serpapi";

const MAX_RESULTS = 4;
const MAX_IMAGES = 8;

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const url of urls) {
    if (typeof url !== "string") continue;
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function immersivePageToken(result) {
  if (result.immersive_product_page_token) return result.immersive_product_page_token;
  const apiUrl = result.serpapi_immersive_product_api;
  if (!apiUrl) return "";
  try {
    return new URL(apiUrl).searchParams.get("page_token") || "";
  } catch {
    return "";
  }
}

async function enrichShoppingResult(result) {
  const fallbackImages = uniqueUrls([result.thumbnail]);
  let brand = "";
  let images = fallbackImages;

  const pageToken = immersivePageToken(result);
  if (pageToken) {
    try {
      const immersive = await getImmersiveProduct(pageToken);
      const product = immersive.product_results || {};
      brand = typeof product.brand === "string" ? product.brand.trim() : "";
      const thumbnails = Array.isArray(product.thumbnails) ? product.thumbnails : [];
      images = uniqueUrls([...thumbnails, ...fallbackImages]).slice(0, MAX_IMAGES);
    } catch {
      // Shopping listing still has a price and thumbnail if immersive details fail.
    }
  }

  return {
    title: result.title,
    brand,
    imageUrl: images[0] || result.thumbnail,
    images,
    sellPrice: result.extracted_price,
    source: result.source,
    immersiveProductPageToken: result.immersive_product_page_token,
  };
}

function shapeShoppingResults(shoppingResults) {
  return Promise.all(shoppingResults.slice(0, MAX_RESULTS).map(enrichShoppingResult));
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
