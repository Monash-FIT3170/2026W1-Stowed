import SimpleSchema from "simpl-schema";

export const ProductCategorySchema = new SimpleSchema({
  orgId: { type: String },
  name: { type: String },
});