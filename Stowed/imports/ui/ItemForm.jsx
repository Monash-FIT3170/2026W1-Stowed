import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSubscribe, useTracker} from 'meteor/react-meteor-data';
import { Items } from '/imports/api/items';

export function ItemForm({mode = 'create'}) {
	const navigate = useNavigate();
    const { itemId } = useParams();
    const isEditMode = mode === 'edit';

	const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [location, setLocation] = useState('');

	const isLoading = useSubscribe(isEditMode ? 'items' : null); // Only subscribe to items if we're in edit mode. No need to subscribe when creating a new item.
	const item = useTracker(() => {
		if (!isEditMode) {
			return null; // If we're not in edit mode, we don't need to fetch any item data.
		} return Items.findOne(itemId); // In edit mode, fetch the item data based on the itemId from the URL params.
	}, [isEditMode, itemId]);

    useEffect(() => { //Update form fields with existing item data when in edit mode and item data is available
        if (isEditMode && item) {
            setName(item.name);
            setQuantity(item.quantity);
            setLocation(item.location);
        }
    }, [item]);

	const handleSubmit = (event) => {
		event.preventDefault(); // Prevent the default form submission behavior (which would cause a page reload).

		if(isEditMode){ //If editing, call the update method with the item ID. If creating, call the create method without an ID.
			Meteor.call('items.update', { _id: itemId, name, quantity, location });
		} else  {
			Meteor.call('items.create', { name, quantity, location });
		}
		navigate('/');
	};

    if (isEditMode && isLoading()) { // Show a loading state if we're in edit mode and the item data is still loading from the subscription.
		return (
			<section className='mx-auto w-full max-w-2xl'>
				<h1 className='text-center text-2xl font-bold text-slate-800'>Edit Item</h1>
                <div className='my-5 mb-8 w-full border-t-2 border-slate-300' />
				<p className='text-center text-slate-700'>Loading item...</p>
			</section>
		);
	}

    if (isEditMode && !item) { // Show an error state if the selected item ID doesn't exist in the database.
		return (
			<section className='mx-auto w-full max-w-2xl'>
				<h1 className='text-center text-2xl font-bold text-slate-800'>Edit Item</h1>
                <div className='my-5 mb-8 w-full border-t-2 border-slate-300' />
				<p className='mb-5 text-slate-700'>Item not found</p>
				<Link to='/' className='btn btn-secondary'>Back to Items</Link>
			</section>
		);
	}

	return (
		<section className='mx-auto w-full max-w-2xl'>
			<h1 className='text-center text-2xl font-bold text-slate-800'> {isEditMode ? 'Edit Item' : 'Create Item'}</h1>
			<div className='my-5 mb-8 w-full border-t-2 border-slate-300' />

			<form className='rounded-lg border border-slate-300 bg-white p-6' onSubmit={handleSubmit}>
				<div className='mb-4'>
					<label htmlFor='name' className='form-label'>Name</label>
					<input
						type='text'
						value={name}
						onChange={(e) => setName(e.target.value)}
						className='form-input'
						required
					/>
				</div>

				<div className='mb-4'>
					<label htmlFor='quantity' className='form-label'>Quantity</label>
					<input
						type='number'
						min='0'
						value={quantity}
						onChange={(e) => setQuantity(e.target.value)}
						className='form-input'
						required
					/>
				</div>

				<div className='mb-6'>
					<label htmlFor='location' className='form-label'>Location</label>
					<input
						type='text'
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						className='form-input'
						required
					/>
				</div>

				<div className='flex gap-3'>
					<button className='btn btn-success' type='submit'>{isEditMode ? 'Update Item' : 'Create Item'}</button>
					<Link to='/' className='btn btn-secondary'>Cancel</Link>
				</div>
			</form>
		</section>
	);
}
