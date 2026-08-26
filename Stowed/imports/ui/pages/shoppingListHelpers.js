export const currency = (value) =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export const CATEGORY_FALLBACK = "Uncategorized";

export function categoryNameOf(item, categoryNameById) {
  return categoryNameById?.get(item.categoryId) || CATEGORY_FALLBACK;
}

export function sortByCategory(items, categoryNameById) {
  return [...items].sort((a, b) => {
    const catCompare = categoryNameOf(a, categoryNameById).localeCompare(
      categoryNameOf(b, categoryNameById),
    );
    if (catCompare !== 0) return catCompare;
    return a.productName.localeCompare(b.productName);
  });
}

/** Dollars to whole cents. Math.round absorbs the float error in 18.9 * 100. */
export const toCents = (value) => Math.round((Number(value) || 0) * 100);

/** Whole cents back to dollars, for display through `currency`. */
export const fromCents = (cents) => cents / 100;
