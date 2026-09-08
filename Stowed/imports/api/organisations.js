import { Mongo } from "meteor/mongo";
import SimpleSchema from "simpl-schema";
import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

export const Organisations = new Mongo.Collection("organisations");

export const OrganisationsSchema = new SimpleSchema({
  name: { type: String, min: 1 },
  code: { type: String, min: 1, max: 20 },
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

if (Meteor.isServer) {
  Meteor.startup(() => {
    Organisations.rawCollection().createIndex({ code: 1 }, { unique: true });
  });
}

/**
 * Organisation Methods
 */
Meteor.methods({
  // Whether an organisation code is in use. Callable without an account, since
  // the customer gateway (/org/:orgCode) has to resolve the code before there
  // is any session to speak of. Returns only a boolean so an anonymous caller
  // learns nothing about the organisation beyond the code they already supplied.
  "organisations.exists": async function ({ orgCode }) {
    check(orgCode, String);

    const code = orgCode.trim().toLowerCase();
    if (!code) return false;

    const org = await Organisations.findOneAsync({ code }, { fields: { _id: 1 } });
    return !!org;
  },
});
