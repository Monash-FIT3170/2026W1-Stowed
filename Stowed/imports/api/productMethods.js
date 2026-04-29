import { Meteor } from 'meteor/meteor';
import { Products } from './products';

// Server RPC endpoints consumed by the React UI.
Meteor.methods({
	async 'products.create'({ name, quantity, location }) {
		// Insert a new inventory record.
		return await Products.insertAsync({ name, quantity, location });
	},

	async 'products.update'({ _id, name, quantity, location }) {
		// Update only editable fields on the selected product.
		await Products.updateAsync(_id, { $set: { name, quantity, location } });
	},

	async 'products.delete'({ _id }) {
		// Remove the selected product.
		await Products.removeAsync(_id);
	},
});
