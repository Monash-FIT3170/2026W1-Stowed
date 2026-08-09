import { FREQUENCY_WEEKS, ADD_PRODUCT_MODES } from "/imports/api/shoppingLists/constants";

// change when real data is used instead of mock
export function quantityFor(product, frequency) {
  const target = Math.max(product.reorderAt ?? 0, product.lowStockThreshold ?? 0);
  const shortfall = target - (product.quantity ?? 0);
  return Math.max(1, shortfall) * (FREQUENCY_WEEKS[frequency] ?? 1);
}

export function toItem(product, frequency, addMode) {
  return {
    productId: product._id,
    productName: product.name,
    sku: product.sku,
    category: product.category,
    inStock: product.quantity ?? 0,
    reorderAt: product.reorderAt ?? 0,
    lowStockThreshold: product.lowStockThreshold ?? 0,
    unitCost: product.purchaseCost ?? product.unitCost ?? 0,
    quantityWanted: addMode === ADD_PRODUCT_MODES.GENERATED ? quantityFor(product, frequency) : 1,
    addMode,
    purchased: false,
    received: false,
  };
}

export function nextOrderDay(frequency) {
  const date = new Date();
  date.setDate(date.getDate() + (FREQUENCY_WEEKS[frequency] ?? 1) * 7);
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const currency = (value) =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export function sortByCategory(items) {
  return [...items].sort((a, b) => {
    const catCompare = (a.category || "Uncategorized").localeCompare(b.category || "Uncategorized");
    if (catCompare !== 0) return catCompare;
    return a.productName.localeCompare(b.productName);
  });
}
