import { ItemRow } from "./ItemRow";
import { useTracker, useSubscribe } from "meteor/react-meteor-data";
import { Items } from "/imports/api/items";
import { Link } from "react-router-dom";

export function ItemList() {
    const isLoading = useSubscribe("items");
    const items = useTracker(() => Items.find().fetch());

    if (isLoading()) {
        return (
            <section className='mx-auto w-full max-w-3xl'>
                <h2 className='text-center text-2xl font-bold text-slate-800'>Inventory Items</h2>
                <div className='my-5 border-t-2 border-slate-300' />
                <p className='text-center text-lg text-slate-600'>Loading items...</p>
            </section>
        );
    }


    return (
        <section className='mx-auto w-full max-w-3xl'>
            <h2 className='text-center text-2xl font-bold text-slate-800'>Inventory Items</h2>
            <div className='my-5 border-t-2 border-slate-300' />

            <div className='mx-auto mb-5 flex w-full max-w-3xl justify-left'>
                <Link to='/items/new' className='btn btn-success'>Create Item</Link>
            </div>

            <div className='overflow-x-auto rounded-lg border-2 border-slate-400 bg-white'>
                <table className='item-table'>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Quantity</th>
                            <th>Location</th>
                            <th className="w-px text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <ItemRow key={item._id} item={item} />
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
