import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from '/imports/api/locations/collections';

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '16px',
};

const dividerStyle = {
  borderTop: '1px solid #ccc',
  marginTop: '8px',
  marginBottom: '16px',
};

const assignmentRowStyle = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  marginBottom: '8px',
};

// Wraps Meteor.call in a Promise so we can use async/await.
function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

// Builds a full readable path for a StorageLocation, e.g.:
// "Warehouse A → Ground Floor → Shelf 1 → Box A"
function buildLocationLabel(location, storageUnits, floorMaps, sites) {
  const unit     = storageUnits.find((u) => u._id === location.storageUnitId);
  const floorMap = unit     ? floorMaps.find((f) => f._id === unit.floorMapId)  : null;
  const site     = floorMap ? sites.find((s)     => s._id === floorMap.siteId)  : null;

  return [site?.name, floorMap?.name, unit?.name, location.name]
    .filter(Boolean)
    .join(' → ');
}

export function CreateProductPage() {
  const navigate = useNavigate();

  const [name, setName]                   = useState('');
  const [description, setDescription]     = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [assignments, setAssignments]     = useState([]);

  const { sites, floorMaps, storageUnits, storageLocations } = useTracker(() => {
    Meteor.subscribe('locations.all');
    return {
      sites:            Sites.find().fetch(),
      floorMaps:        FloorMaps.find().fetch(),
      storageUnits:     StorageUnits.find().fetch(),
      storageLocations: StorageLocations.find().fetch(),
    };
  }, []);

  function addAssignment() {
    setAssignments([...assignments, { locationId: '', quantity: '' }]);
  }

  function removeAssignment(index) {
    setAssignments(assignments.filter((_, i) => i !== index));
  }

  function updateAssignment(index, field, value) {
    const updated = assignments.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    setAssignments(updated);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      // Step 1: create the product, get back its new _id.
      const productId = await callMethod('products.create', {
        name,
        description,
        totalQuantity: parseInt(totalQuantity, 10),
      });

      // Step 2: create a ProductRecord for each filled-in assignment row.
      const recordPromises = assignments
        .filter((a) => a.locationId && a.quantity !== '')
        .map((a) =>
          callMethod('productRecords.create', {
            productId,
            locationId: a.locationId,
            quantity:   parseInt(a.quantity, 10),
          })
        );

      await Promise.all(recordPromises);
      navigate('/');
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  }

  function handleCancel() {
    navigate('/');
  }

  return (
    <div style={{ padding: '24px', maxWidth: '560px' }}>
      <h1>Create Product</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>

        {/* Product details */}
        <div style={fieldStyle}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="totalQuantity">Total Quantity</label>
          <input
            id="totalQuantity"
            type="number"
            min="0"
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value)}
          />
        </div>

        {/* Location assignments */}
        <div style={dividerStyle} />
        <h2>Assign to Locations</h2>
        <p>Assign the received stock to one or more storage locations.</p>

        {assignments.length === 0 && (
          <p>No locations assigned yet.</p>
        )}

        {assignments.map((assignment, index) => (
          <div key={index} style={assignmentRowStyle}>
            <select
              value={assignment.locationId}
              onChange={(e) => updateAssignment(index, 'locationId', e.target.value)}
              style={{ flex: 2 }}
            >
              <option value="">Select a location...</option>
              {storageLocations.map((location) => (
                <option key={location._id} value={location._id}>
                  {buildLocationLabel(location, storageUnits, floorMaps, sites)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              placeholder="Qty"
              value={assignment.quantity}
              onChange={(e) => updateAssignment(index, 'quantity', e.target.value)}
              style={{ flex: 1 }}
            />

            <button type="button" onClick={() => removeAssignment(index)}>
              Remove
            </button>
          </div>
        ))}

        {storageLocations.length === 0 ? (
          <p>No storage locations have been set up yet. Add some in the Locations page first.</p>
        ) : (
          <button type="button" onClick={addAssignment} style={{ marginBottom: '16px' }}>
            + Add Location
          </button>
        )}

        {/* Form actions */}
        <div style={{ ...dividerStyle, display: 'flex', gap: '8px', paddingTop: '16px' }}>
          <button type="submit">Create</button>
          <button type="button" onClick={handleCancel}>Cancel</button>
        </div>

      </form>
    </div>
  );
}
