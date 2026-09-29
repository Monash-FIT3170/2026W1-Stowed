export const MAX_RESULTS = 4;
export const MAX_IMAGES = 8;

export function uniqueUrls(urls) {
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

export function immersivePageToken(result) {
  if (result.immersive_product_page_token) return result.immersive_product_page_token;
  const apiUrl = result.serpapi_immersive_product_api;
  if (!apiUrl) return "";
  try {
    return new URL(apiUrl).searchParams.get("page_token") || "";
  } catch {
    return "";
  }
}

// Skip the first Lens match - it is often the uploaded source image itself.
export function productTitleFromLensMatches(visualMatches) {
  const matches = Array.isArray(visualMatches) ? visualMatches : [];
  const topMatch = matches[1] || matches[0];
  return topMatch?.title || "";
}

export async function enrichShoppingResult(result, fetchImmersiveProduct) {
  const fallbackImages = uniqueUrls([result.thumbnail]);
  let brand = "";
  let images = fallbackImages;

  const pageToken = immersivePageToken(result);
  if (pageToken) {
    try {
      const immersive = await fetchImmersiveProduct(pageToken);
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

export function shapeShoppingResults(shoppingResults, fetchImmersiveProduct) {
  return Promise.all(
    shoppingResults
      .slice(0, MAX_RESULTS)
      .map((result) => enrichShoppingResult(result, fetchImmersiveProduct)),
  );
}
