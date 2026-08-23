import { Meteor } from "meteor/meteor";

/**
 * Registers a suite that can only run on the server - one that reaches for
 * Meteor.server, rawCollection, or writes to real collections.
 *
 * The client bundle still loads every test file, so an unguarded server-only
 * suite throws while the browser run is collecting tests and takes the entire
 * client suite down with it. Reporting the suite as pending keeps the rest of
 * the run alive, and keeps it visible that these tests were not covered here.
 */
export function describeServer(title, fn) {
  return Meteor.isServer ? describe(title, fn) : describe.skip(title, fn);
}
