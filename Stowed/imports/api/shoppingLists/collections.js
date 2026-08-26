import { Mongo } from "meteor/mongo";
import "meteor/aldeed:collection2/static";
import { ShoppingListSchema } from "./schemas";

export const ShoppingLists = new Mongo.Collection("shoppingLists");
ShoppingLists.attachSchema(ShoppingListSchema);
