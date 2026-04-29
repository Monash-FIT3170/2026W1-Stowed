import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from '/imports/api/locations/collections';

// brief styling to be fixed later

const inputStyle = {
  padding: '6px 8px',
  border: '1px solid #999',
  borderRadius: '3px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

const buttonStyle = {
  padding: '6px 14px',
  border: '1px solid #333',
  borderRadius: '3px',
  cursor: 'pointer',
  background: 'transparent',
  fontSize: '14px',
};

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '16px',
};

const sectionStyle = {
  borderTop: '1px solid #ccc',
  marginTop: '24px',
  paddingTop: '16px',
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
// "Main Warehouse → Ground Floor → Shelf A → Bay 1"
function buildLocationLabel(location, storageUnits, floorMaps, sites) {
  const unit     = storageUnits.find((u) => u._id === location.storageUnitId);
  const floorMap = unit     ? floorMaps.find((f) => f._id === unit.floorMapId) : null;
  const site     = floorMap ? sites.find((s) => s._id === floorMap.siteId)     : null;

  return [site?.name, floorMap?.name, unit?.name, location.name]
    .filter(Boolean)
    .join(' → ');
}

// Component 

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
    setAssignments(assignments.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    ));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      // Step 1: create the product and get back its new _id.
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

  const locationsExist = storageLocations.length > 0;

  return (
    <div style={{ padding: '24px', maxWidth: '560px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>
        Create Product
      </h1>
      <p style={{ marginBottom: '24px', color: '#555' }}>
        Enter the product details below.
      </p>

      <form onSubmit={handleSubmit}>

        {/* ── Product details ── */}
        <div style={fieldStyle}>
          <label htmlFor="name"><strong>Name</strong></label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="description"><strong>Description</strong></label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="totalQuantity"><strong>Total Quantity</strong></label>
          <input
            id="totalQuantity"
            type="number"
            min="0"
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value)}
            style={{ ...inputStyle, maxWidth: '160px' }}
          />
        </div>

        {/* ── Location assignments ── */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', marginBottom: '4px' }}>
            Assign to Locations
          </h2>
          <p style={{ marginBottom: '16px', color: '#555' }}>
            Assign the received stock to one or more storage locations.
          </p>

          {!locationsExist ? (
            <p>
              No storage locations have been set up yet.{' '}
              <Link to="/locations">
                <button type="button" style={buttonStyle}>
                  Go to Locations
                </button>
              </Link>
            </p>
          ) : (
            <>
              {assignments.map((assignment, index) => (
                <div key={index} style={assignmentRowStyle}>
                  <select
                    value={assignment.locationId}
                    onChange={(e) => updateAssignment(index, 'locationId', e.target.value)}
                    style={{ ...inputStyle, flex: 2 }}
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
                    style={{ ...inputStyle, flex: 1, maxWidth: '80px' }}
                  />

                  <button
                    type="button"
                    onClick={() => removeAssignment(index)}
                    style={buttonStyle}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addAssignment}
                style={{ ...buttonStyle, marginTop: '4px' }}
              >
                + Add Location
              </button>
            </>
          )}
        </div>

        {/* ── Form actions ── */}
        <div style={{ ...sectionStyle, display: 'flex', gap: '8px' }}>
          <button type="submit" style={buttonStyle}>
            Create
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={buttonStyle}
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  );
}
