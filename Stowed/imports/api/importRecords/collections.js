import { Mongo } from "meteor/mongo";

/**
 * Organisation-scoped audit trail for bulk data imports. Each completed record
 * stores the IDs created by that import so the latest import can be undone.
 */
export const ImportRecords = new Mongo.Collection("importRecords");
