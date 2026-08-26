import { Meteor } from "meteor/meteor";

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";

// Reads the key lazily (not at module load) since ES module imports are
// hoisted and evaluate before this file's importer has a chance to load .env.
function getApiKey() {
  const apiKey = process.env.SERP_API_KEY || Meteor.settings?.SERP_API_KEY;
  if (!apiKey) {
    throw new Meteor.Error(
      "serpapi-not-configured",
      "SERP_API_KEY is not set (add it to a .env file at the project root).",
    );
  }
  return apiKey;
}

async function callSerpApi(params) {
  const url = new URL(SERPAPI_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });
  url.searchParams.set("api_key", getApiKey());

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Meteor.Error(
      "serpapi-request-failed",
      data.error || `SerpApi request failed (${response.status}).`,
    );
  }

  return data;
}

// Reverse image search - identifies visually similar products from a public image URL.
export async function searchLensByImageUrl(imageUrl) {
  const data = await callSerpApi({
    engine: "google_lens",
    url: imageUrl,
    type: "visual_matches",
  });

  return data.visual_matches || [];
}

// Product search by text query, via Google Shopping.
export async function searchShopping(query) {
  const data = await callSerpApi({
    engine: "google_shopping_light",
    q: query,
  });

  return data.shopping_results || [];
}
