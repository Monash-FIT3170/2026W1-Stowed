import { Meteor } from "meteor/meteor";
import '/imports/api/productMethods';
import { Products } from "/imports/api/products";
import '/imports/api/locations/methods';
import '/imports/api/locations/publications';

async function addProduct({ name, quantity, location }) {
  await Products.insertAsync({ name, quantity, location });
}

Meteor.startup(async () => {
  const productCount = await Products.find().countAsync();

  if (productCount == 0) {
    addProduct({ name: "Boxes", quantity: 5, location: "Shelf 1" });
    addProduct({ name: "Tools", quantity: 7, location: "Shelf 2" });
    addProduct({ name: "Batteries", quantity: 12, location: "Shelf 4" });
  }

  Meteor.publish('products', function () {
    return Products.find();
  });

});
