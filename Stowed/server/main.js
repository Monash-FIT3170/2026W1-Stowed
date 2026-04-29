import { Meteor } from 'meteor/meteor';
import '/imports/api/productMethods';
import { Products } from '/imports/api/products';
import { ProductRecords } from '/imports/api/productRecords';
import '/imports/api/locations/methods';
import '/imports/api/locations/publications';

async function addProduct({ name, description, totalQuantity }) {
  const now = new Date();
  await Products.insertAsync({ name, description, totalQuantity, createdAt: now, updatedAt: now });
}

Meteor.startup(async () => {
  const productCount = await Products.find().countAsync();

  if (productCount === 0) {
    addProduct({ name: 'Boxes',     description: 'Standard cardboard boxes.', totalQuantity: 5  });
    addProduct({ name: 'Tools',     description: 'General-purpose hand tools.', totalQuantity: 7  });
    addProduct({ name: 'Batteries', description: 'AA alkaline batteries.',      totalQuantity: 12 });
  }

  Meteor.publish('products', function () {
    return Products.find();
  });

  Meteor.publish('productRecords', function () {
    return ProductRecords.find();
  });
});
