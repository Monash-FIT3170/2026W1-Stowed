import {
  FREQUENCY_WEEKS,
  ADD_PRODUCT_MODES,
  BUDGET_STRATEGIES,
} from "/imports/api/shoppingLists/constants";

export function quantityFor(product, frequency) {
  const target = Math.max(product.reorderAt ?? 0, product.lowStockThreshold ?? 0);
  const shortfall = target - (product.totalQuantity ?? 0);
  return Math.max(1, shortfall) * (FREQUENCY_WEEKS[frequency] ?? 1);
}

export function toItem(product, frequency, addMode) {
  return {
    productId: product._id,
    productName: product.name,
    category: product.category,
    inStock: product.totalQuantity ?? 0,
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

export function isLowStock(product) {
  return typeof product.reorderAt === "number" && (product.totalQuantity ?? 0) <= product.reorderAt;
}

/** Dollars to whole cents. Math.round absorbs the float error in 18.9 * 100. */
export const toCents = (value) => Math.round((Number(value) || 0) * 100);

/** Whole cents back to dollars, for display through `currency`. */
export const fromCents = (cents) => cents / 100;

/** Mirrors the cost field `toItem` uses, so preview and list agree. */
function unitCentsOf(product) {
  return toCents(product.purchaseCost ?? product.unitCost ?? 0);
}

/**
 * How close a product is to a stockout. Lower is more urgent.
 * reorderAt of 0 would give 0 / 0, so it is treated as fully depleted.
 */
function depletionOf(product) {
  const reorderAt = typeof product.reorderAt === "number" ? product.reorderAt : 0;
  if (reorderAt <= 0) return 0;
  return (product.totalQuantity ?? 0) / reorderAt;
}

/**
 * Picks which low stock products, and how many of each, fit inside a budget.
 *
 * All arithmetic is in whole cents. `budgetCents` of null, undefined or any
 * non-finite value means no budget, in which case everything is included and
 * `remainingCents` comes back null.
 *
 * Returns { items, skipped, spentCents, remainingCents }, where `skipped` is
 * the product documents that did not fit, so the caller can name them.
 */
export function allocateWithinBudget(products, { frequency, strategy, budgetCents }) {
  const lines = products.map((product) => {
    const unitCents = unitCentsOf(product);
    const target = quantityFor(product, frequency);
    return {
      product,
      unitCents,
      target,
      lineCents: unitCents * target,
      depletion: depletionOf(product),
    };
  });

  if (!Number.isFinite(budgetCents)) {
    return {
      items: lines.map((line) => toItem(line.product, frequency, ADD_PRODUCT_MODES.GENERATED)),
      skipped: [],
      spentCents: lines.reduce((sum, line) => sum + line.lineCents, 0),
      remainingCents: null,
    };
  }

  // Every sort falls back to _id, so regenerating twice gives the same list.
  const byId = (a, b) => a.product._id.localeCompare(b.product._id);
  const sortBy = (compare) => [...lines].sort((a, b) => compare(a, b) || byId(a, b));

  let ordered;
  if (strategy === BUDGET_STRATEGIES.URGENT) {
    ordered = sortBy((a, b) => a.depletion - b.depletion);
  } else if (strategy === BUDGET_STRATEGIES.SPREAD) {
    ordered = sortBy((a, b) => a.unitCents - b.unitCents);
  } else {
    ordered = sortBy((a, b) => a.lineCents - b.lineCents);
  }

  const taken = new Map();
  let remainingCents = budgetCents;

  if (strategy === BUDGET_STRATEGIES.SPREAD) {
    // First pass: one unit of each product that can afford a single unit.
    ordered.forEach((line) => {
      if (line.unitCents > remainingCents) return;
      remainingCents -= line.unitCents;
      taken.set(line.product._id, 1);
    });

    // Then top up towards each product's normal shortfall, a unit at a time,
    // until a whole pass adds nothing. Bounded by target, so it terminates
    // even when every unit is free.
    let addedThisPass = true;
    while (addedThisPass) {
      addedThisPass = false;
      ordered.forEach((line) => {
        const current = taken.get(line.product._id);
        if (current === undefined || current >= line.target) return;
        if (line.unitCents > remainingCents) return;
        remainingCents -= line.unitCents;
        taken.set(line.product._id, current + 1);
        addedThisPass = true;
      });
    }
  } else {
    // Whole shortfall or nothing. A line that does not fit is skipped, and the
    // loop carries on, so one expensive product cannot strand the budget.
    ordered.forEach((line) => {
      if (line.lineCents > remainingCents) return;
      remainingCents -= line.lineCents;
      taken.set(line.product._id, line.target);
    });
  }

  const items = ordered
    .filter((line) => taken.has(line.product._id))
    .map((line) => ({
      ...toItem(line.product, frequency, ADD_PRODUCT_MODES.GENERATED),
      quantityWanted: taken.get(line.product._id),
    }));

  const skipped = ordered
    .filter((line) => !taken.has(line.product._id))
    .map((line) => line.product);

  return { items, skipped, spentCents: budgetCents - remainingCents, remainingCents };
}
