import { Meteor } from "meteor/meteor";
import '/imports/api/itemMethods';
import { Items } from "/imports/api/items";
import '/imports/api/locations/methods';
import '/imports/api/locations/publications';

async function addItem({ name, quantity, location }) {
  await Items.insertAsync({ name, quantity, location });
}

Meteor.startup(async () => {
  const itemCount = await Items.find().countAsync();

  if(itemCount == 0) {
    addItem({ name: "Boxes", quantity: 5, location: "Shelf 1" });
    addItem({ name: "Tools", quantity: 7, location: "Shelf 2" });
    addItem({ name: "Batteries", quantity: 12, location: "Shelf 4" });
  }

  Meteor.publish('items', function () {
    return Items.find();
  });

});
