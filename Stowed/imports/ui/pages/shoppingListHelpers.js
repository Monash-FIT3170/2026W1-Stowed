export const currency = (value) =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export function sortByCategory(items) {
  return [...items].sort((a, b) => {
    const catCompare = (a.category || "Uncategorized").localeCompare(b.category || "Uncategorized");
    if (catCompare !== 0) return catCompare;
    return a.productName.localeCompare(b.productName);
  });
}

/** Dollars to whole cents. Math.round absorbs the float error in 18.9 * 100. */
export const toCents = (value) => Math.round((Number(value) || 0) * 100);

/** Whole cents back to dollars, for display through `currency`. */
export const fromCents = (cents) => cents / 100;
