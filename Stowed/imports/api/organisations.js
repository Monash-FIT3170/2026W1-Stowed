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

// Org codes form the prefix of compound usernames (`${code}~${username}`),
// so keep them short and free of the "~" separator.
export const ORG_CODE_MAX_LENGTH = 20;
export const ORG_CODE_REQUIRED_MESSAGE =
  "You need to create an organisation code — your team will use it to log in.";
export const ORG_CODE_FORMAT_MESSAGE = `Organisation code can only use letters, numbers, - and _ (max ${ORG_CODE_MAX_LENGTH} characters).`;

// Returns an error message for an invalid org code, or "" when it is valid.
export function validateOrgCode(code) {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return ORG_CODE_REQUIRED_MESSAGE;
  if (trimmed.length > ORG_CODE_MAX_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return ORG_CODE_FORMAT_MESSAGE;
  }
  return "";
}

if (Meteor.isServer) {
  Meteor.startup(() => {
    Organisations.rawCollection().createIndex({ code: 1 }, { unique: true });
  });
}

/**
 * Resolves an organisation code as a visitor typed it - any case, stray spaces -
 * to the organisation's id, or null when no organisation uses it. Shared by the
 * gateway check below and the customer catalogue methods, which scope an
 * account-less visitor by code alone.
 */
export async function findOrgIdByCode(orgCode) {
  check(orgCode, String);

  const code = orgCode.trim().toLowerCase();
  if (!code) return null;

  const org = await Organisations.findOneAsync({ code }, { fields: { _id: 1 } });
  return org ? org._id : null;
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
    return !!(await findOrgIdByCode(orgCode));
  },
});
