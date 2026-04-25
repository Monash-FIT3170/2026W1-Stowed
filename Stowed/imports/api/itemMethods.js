import { Meteor } from 'meteor/meteor';
import { Items } from './items';

// Server RPC endpoints consumed by the React UI.
Meteor.methods({
	async 'items.create'({ name, quantity, location }) {
		// Insert a new inventory record.
		return await Items.insertAsync({ name, quantity, location });
	},

	async 'items.update'({ _id, name, quantity, location }) {
		// Update only editable fields on the selected item.
		await Items.updateAsync(_id, { $set: { name, quantity, location } });
	},

	async 'items.delete'({ _id }) {
		// Remove the selected item.
		await Items.removeAsync(_id);
	},
	});
