import { Meteor } from 'meteor/meteor';

export const Users = Meteor.users;

if (Meteor.isServer) {
  Meteor.startup(() => {
    Users.rawCollection().createIndex({ email: 1 }, { unique: true });
    Users.rawCollection().createIndex({ username: 1 }, { unique: true });
  });
}
