import assert from "assert";
import {
  MAX_RESULTS,
  productTitleFromLensMatches,
  shapeShoppingResults,
} from "../imports/api/products/searchHelpers";

function shoppingItem(overrides = {}) {
  return {
    title: "Apple iPhone 14",
    thumbnail: "https://img.example/shop.jpg",
    extracted_price: 999,
    source: "Amazon",
    immersive_product_page_token: "token-1",
    ...overrides,
  };
}

describe("SerpApi product search pipeline", function () {
  it("attaches brand, gallery images, and price from shopping plus immersive results", async function () {
    const shoppingResults = [shoppingItem()];
    const fetchImmersiveProduct = async (pageToken) => {
      assert.strictEqual(pageToken, "token-1");
      return {
        product_results: {
          brand: "Apple",
          thumbnails: ["https://img.example/front.jpg", "https://img.example/back.jpg"],
        },
      };
    };

    const [result] = await shapeShoppingResults(shoppingResults, fetchImmersiveProduct);

    assert.strictEqual(result.title, "Apple iPhone 14");
    assert.strictEqual(result.brand, "Apple");
    assert.strictEqual(result.sellPrice, 999);
    assert.strictEqual(result.imageUrl, "https://img.example/front.jpg");
    assert.deepStrictEqual(result.images, [
      "https://img.example/front.jpg",
      "https://img.example/back.jpg",
      "https://img.example/shop.jpg",
    ]);
  });

  it("keeps the shopping thumbnail and price when immersive details fail", async function () {
    const shoppingResults = [shoppingItem()];
    const fetchImmersiveProduct = async () => {
      throw new Error("serpapi-request-failed");
    };

    const [result] = await shapeShoppingResults(shoppingResults, fetchImmersiveProduct);

    assert.strictEqual(result.brand, "");
    assert.strictEqual(result.sellPrice, 999);
    assert.strictEqual(result.imageUrl, "https://img.example/shop.jpg");
    assert.deepStrictEqual(result.images, ["https://img.example/shop.jpg"]);
  });

  it("uses the second Lens match as the product title and caps shopping results", async function () {
    assert.strictEqual(
      productTitleFromLensMatches([{ title: "Forum photo of my phone" }, { title: "iPhone 14" }]),
      "iPhone 14",
    );
    assert.strictEqual(productTitleFromLensMatches([{ title: "Only match" }]), "Only match");
    assert.strictEqual(productTitleFromLensMatches([]), "");

    const shoppingResults = Array.from({ length: MAX_RESULTS + 2 }, (_, index) =>
      shoppingItem({
        title: `Item ${index}`,
        thumbnail: `https://img.example/${index}.jpg`,
        extracted_price: index,
        immersive_product_page_token: "",
      }),
    );

    const results = await shapeShoppingResults(shoppingResults, async () => {
      throw new Error("immersive should not run without a page token");
    });

    assert.strictEqual(results.length, MAX_RESULTS);
    assert.deepStrictEqual(
      results.map((result) => result.title),
      ["Item 0", "Item 1", "Item 2", "Item 3"],
    );
  });
});
