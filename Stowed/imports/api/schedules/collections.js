import { Mongo } from "meteor/mongo";
import "meteor/aldeed:collection2/static";
import { ScheduleSchema } from "./schemas";

export const Schedules = new Mongo.Collection("schedules");
Schedules.attachSchema(ScheduleSchema);
