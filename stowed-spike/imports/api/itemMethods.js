import { Meteor } from 'meteor/meteor';
import { Items } from './items';


Meteor.methods({
    async 'items.create'({ name, quantity, location }) {
        return await Items.insertAsync({ name, quantity, location });
    },


    async 'items.update'({ _id, name, quantity, location }) {
        await Items.updateAsync(_id, { $set: { name, quantity, location } });
    },


    async 'items.delete'({ _id }) {
        await Items.removeAsync(_id);
    },
});
