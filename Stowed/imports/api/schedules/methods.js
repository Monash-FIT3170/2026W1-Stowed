import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import { Schedules } from "./collections";
import { getCallerOrgId, assertOrgAccess, requirePermission } from "../userMethods";
import { GENERATION_MODES } from "./constants";
import { computeNextRunAt } from "./timing";

const scheduleItemPattern = {
  productId: String,
  quantityWanted: Match.Integer,
};

const autoConfigPattern = {
  strategy: String,
  budgetCents: Match.Maybe(Match.Integer),
};

Meteor.methods({
  async "schedules.create"({ name, frequency, generationMode, items, autoConfig, siteId }) {
    check(name, String);
    check(frequency, String);
    check(generationMode, String);
    check(items, Match.Maybe([scheduleItemPattern]));
    check(autoConfig, Match.Maybe(autoConfigPattern));
    check(siteId, Match.Maybe(String));

    const trimmedName = name.trim();
    if (!trimmedName) throw new Meteor.Error("invalid-name", "Schedule name cannot be empty.");

    const orgId = await getCallerOrgId(this.userId);

    await requirePermission(this.userId, "schedules.create");

    const now = new Date();

    return await Schedules.insertAsync({
      orgId,
      createdBy: this.userId,
      name: trimmedName,
      frequency,
      generationMode,
      ...(generationMode === GENERATION_MODES.EXPLICIT ? { items: items ?? [] } : {}),
      ...(generationMode === GENERATION_MODES.AUTO ? { autoConfig } : {}),
      ...(siteId !== undefined ? { siteId } : {}),
      isActive: true,
      nextRunAt: computeNextRunAt(frequency, now),
      createdAt: now,
      updatedAt: now,
    });
  },

  async "schedules.update"({
    scheduleId,
    name,
    frequency,
    generationMode,
    items,
    autoConfig,
    siteId,
  }) {
    check(scheduleId, String);
    check(name, Match.Maybe(String));
    check(frequency, Match.Maybe(String));
    check(generationMode, Match.Maybe(String));
    check(items, Match.Maybe([scheduleItemPattern]));
    check(autoConfig, Match.Maybe(autoConfigPattern));
    check(siteId, Match.Maybe(String));

    await assertOrgAccess(Schedules, scheduleId, this.userId);
    await requirePermission(this.userId, "schedules.update");

    const set = { updatedAt: new Date() };
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Meteor.Error("invalid-name", "Schedule name cannot be empty.");
      set.name = trimmedName;
    }
    if (generationMode !== undefined) set.generationMode = generationMode;
    if (items !== undefined) set.items = items;
    if (autoConfig !== undefined) set.autoConfig = autoConfig;
    if (siteId !== undefined) set.siteId = siteId;

    if (frequency !== undefined) {
      set.frequency = frequency;
      // Editing the cadence always restarts the countdown from now, so an
      // edit can never leave a nextRunAt that's already in the past.
      set.nextRunAt = computeNextRunAt(frequency, new Date());
    }

    await Schedules.updateAsync(scheduleId, { $set: set });
  },

  async "schedules.setActive"({ scheduleId, isActive }) {
    check(scheduleId, String);
    check(isActive, Boolean);

    await assertOrgAccess(Schedules, scheduleId, this.userId);
    await requirePermission(this.userId, "schedules.setActive");

    const set = { isActive, updatedAt: new Date() };

    if (isActive) {
      const schedule = await Schedules.findOneAsync(scheduleId);
      // Resuming restarts the countdown from now, so a schedule paused for
      // days doesn't fire an immediate backlog the moment it's resumed.
      set.nextRunAt = computeNextRunAt(schedule.frequency, new Date());
    }

    await Schedules.updateAsync(scheduleId, { $set: set });
  },

  async "schedules.delete"({ scheduleId }) {
    check(scheduleId, String);

    await assertOrgAccess(Schedules, scheduleId, this.userId);
    await requirePermission(this.userId, "schedules.delete");

    await Schedules.removeAsync(scheduleId);
  },
});
