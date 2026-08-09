import { Mongo } from "meteor/mongo";
import "meteor/aldeed:collection2/static";
import { ProductCategorySchema } from "./schemas";

export const ProductCategories = new Mongo.Collection("productCategories");
ProductCategories.attachSchema(ProductCategorySchema);