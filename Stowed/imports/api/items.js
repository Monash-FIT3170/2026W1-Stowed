import { Mongo } from "meteor/mongo";

// Shared collection used by Meteor methods on the server and subscriptions on the client.
export const Items = new Mongo.Collection("items");