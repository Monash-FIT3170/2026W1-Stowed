import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';

export function CreateProductPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    Meteor.call(
      'products.create',
      {
        name,
        description,
        totalQuantity: parseInt(totalQuantity, 10),
      },
      (error) => {
        if (error) {
          console.error('Failed to create product:', error);
          return;
        }
        navigate('/');
      }
    );
  }

  function handleCancel() {
    navigate('/');
  }

  return (
    <div>
      <h1>Create Product</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="totalQuantity">Total Quantity</label>
          <input
            id="totalQuantity"
            type="number"
            min="0"
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value)}
          />
        </div>

        <button type="submit">Create</button>
        <button type="button" onClick={handleCancel}>Cancel</button>
      </form>
    </div>
  );
}
