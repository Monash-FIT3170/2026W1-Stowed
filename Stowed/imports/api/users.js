import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

export const Users = new Mongo.Collection('users');

if (Meteor.isServer) {
  // Ensure uniqueness for login/registration lookups
  Meteor.startup(() => {
    Users.rawCollection().createIndex({ email: 1 }, { unique: true });
    Users.rawCollection().createIndex({ username: 1 }, { unique: true });
  });
}