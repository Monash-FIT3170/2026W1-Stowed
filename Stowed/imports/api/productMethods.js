import { Meteor } from 'meteor/meteor';
import { Products } from './products';

// Server RPC endpoints consumed by the React UI.
Meteor.methods({
  async 'products.create'({ name, description, totalQuantity }) {
    const now = new Date();
    return await Products.insertAsync({
      name,
      description,
      totalQuantity,
      createdAt: now,
      updatedAt: now,
    });
  },

  async 'products.update'({ _id, name, description, totalQuantity }) {
    await Products.updateAsync(_id, {
      $set: { name, description, totalQuantity, updatedAt: new Date() },
    });
  },

  async 'products.delete'({ _id }) {
    await Products.removeAsync(_id);
  },
});
