import { Meteor } from 'meteor/meteor';
import '/imports/api/productMethods';
import '/imports/api/productRecordMethods';
import { Products } from '/imports/api/products';
import { ProductRecords } from '/imports/api/productRecords';
import '/imports/api/locations/methods';
import '/imports/api/locations/publications';

async function addProduct({ name, description, totalQuantity }) {
  const now = new Date();
  await Products.insertAsync({ name, description, totalQuantity, createdAt: now, updatedAt: now });
}

Meteor.startup(async () => {

  //await Products.removeAsync({});  // TEMP: force reseed 

  const productCount = await Products.find().countAsync();

  if (productCount === 0) {
    addProduct({ name: 'Cardboard Boxes',   description: 'Medium-sized cardboard boxes used for general storage and shipping.',  totalQuantity: 48  });
    addProduct({ name: 'Hand Tools',        description: 'Assorted hand tools including hammers, screwdrivers, and wrenches.',    totalQuantity: 23  });
    addProduct({ name: 'AA Batteries',      description: 'AA alkaline batteries, packed in sets of 4.',                           totalQuantity: 120 });
    addProduct({ name: 'Safety Helmets',    description: 'Hard hats rated for construction site use.',                            totalQuantity: 15  });
    addProduct({ name: 'Packing Tape',      description: 'Heavy-duty clear packing tape, 50mm wide.',                             totalQuantity: 60  });
    addProduct({ name: 'Cable Ties',        description: 'Nylon cable ties in assorted sizes for bundling and organising.',       totalQuantity: 300 });
  }

  Meteor.publish('products', function () {
    return Products.find();
  });

  Meteor.publish('productRecords', function () {
    return ProductRecords.find();
  });
});
