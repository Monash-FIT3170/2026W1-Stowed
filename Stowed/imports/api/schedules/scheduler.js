import { Meteor } from "meteor/meteor";
import { Schedules } from "./collections";
import { ShoppingLists } from "../shoppingLists/collections";
import { Products } from "../products/collections";
import { GENERATION_MODES } from "./constants";
import { LIST_ORIGINS, LIST_STATUSES, LIST_FREQUENCIES } from "../shoppingLists/constants";
import { toExplicitItem, isLowStock, allocateWithinBudget } from "../shoppingLists/generation";
import { computeNextRunAt } from "./timing";

// NOTE: this ticker runs per-process with no distributed lock. Correct for
// this app's single Meteor server, but running it unmodified across more
// than one server instance would double-fire every schedule.
const TICK_MS = 5000;

export function startScheduler() {
  Meteor.setInterval(tick, TICK_MS);
}

async function tick() {
  const due = await Schedules.find({
    isActive: true,
    nextRunAt: { $lte: new Date() },
  }).fetchAsync();

  for (const schedule of due) {
    await runSchedule(schedule);
  }
}

async function buildExplicitItems(schedule) {
  const items = [];
  for (const templateItem of schedule.items ?? []) {
    const product = await Products.findOneAsync(templateItem.productId);
    if (!product) continue; // product deleted since the schedule was made, skip it
    items.push(toExplicitItem(product, templateItem.quantityWanted));
  }
  return items;
}

async function buildAutoItems(schedule) {
  const products = await Products.find({ orgId: schedule.orgId }).fetchAsync();
  const lowStock = products.filter(isLowStock);

  // test30s has no quantity-scaling entry, so it falls back to weekly scaling
  const frequency = Object.values(LIST_FREQUENCIES).includes(schedule.frequency)
    ? schedule.frequency
    : LIST_FREQUENCIES.WEEKLY;

  const result = allocateWithinBudget(lowStock, {
    frequency,
    strategy: schedule.autoConfig.strategy,
    budgetCents: schedule.autoConfig.budgetCents ?? null,
  });

  return result.items;
}

async function runSchedule(schedule) {
  const items =
    schedule.generationMode === GENERATION_MODES.EXPLICIT
      ? await buildExplicitItems(schedule)
      : await buildAutoItems(schedule);

  const now = new Date();

  await ShoppingLists.insertAsync({
    orgId: schedule.orgId,
    createdBy: schedule.createdBy,
    name: `${schedule.name} (${now.toLocaleDateString("en-AU")})`,
    origin: LIST_ORIGINS.SCHEDULED,
    scheduleId: schedule._id,
    scheduleName: schedule.name,
    status: LIST_STATUSES.DRAFT,
    ...(schedule.siteId !== undefined ? { siteId: schedule.siteId } : {}),
    items,
    createdAt: now,
    updatedAt: now,
  });

  await Schedules.updateAsync(schedule._id, {
    $set: {
      lastRunAt: now,
      nextRunAt: computeNextRunAt(schedule.frequency, now),
    },
  });
}
