import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

export const Users = new Mongo.Collection('users');

export const Organisations = new Mongo.Collection('organisations');

// Organisations schema
export const OrganisationsSchema = new SimpleSchema({
  name: {
    type: String,
    required: true,
    min: 1,
  },
  createdAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
  },
});

Organisations.attachSchema(OrganisationsSchema);

if (Meteor.isServer) {
  // Ensure uniqueness for login/registration lookups
  Meteor.startup(() => {
    Users.rawCollection().createIndex({ email: 1 }, { unique: true });
    Users.rawCollection().createIndex({ username: 1 }, { unique: true });
  });
}

