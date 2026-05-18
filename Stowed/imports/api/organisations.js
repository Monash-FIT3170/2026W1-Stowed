import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import { Meteor } from 'meteor/meteor';

export const Organisations = new Mongo.Collection('organisations');

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