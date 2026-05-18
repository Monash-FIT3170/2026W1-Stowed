import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Products, ProductRecords } from '/imports/api/products/collections';
import { Sites, FloorMaps, StorageUnits, StorageLocations } from '/imports/api/locations/collections';

// Wraps Meteor.call in a Promise so we can use async/await.
function callMethod(methodName, params) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

// brief styling to be fixed later

const buttonStyle = {
  padding: '6px 14px',
  border: '1px solid #333',
  borderRadius: '3px',
  cursor: 'pointer',
  background: 'transparent',
  fontSize: '14px',
};

const dangerButtonStyle = {
  ...buttonStyle,
  border: '1px solid #c00',
  color: '#c00',
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const modalStyle = {
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: '6px',
  padding: '28px',
  maxWidth: '400px',
  width: '100%',
};

const sectionStyle = {
  borderTop: '1px solid #ccc',
  marginTop: '24px',
  paddingTop: '16px',
};

const thStyle = {
  padding: '8px 16px',
  textAlign: 'left',
  borderBottom: '1px solid #ccc',
};

const tdStyle = {
  padding: '8px 16px',
};

const inputStyle = {
  padding: '6px 8px',
  border: '1px solid #999',
  borderRadius: '3px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

const assignmentRowStyle = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  marginBottom: '8px',
};

const warningStyle = {
  marginTop: '4px',
  fontStyle: 'italic',
  fontSize: '13px',
};

function buildLocationLabel(locationId, storageLocations, storageUnits, floorMaps, sites) {
  const location = storageLocations.find((l) => l._id === locationId);
  if (!location) return locationId;
  const unit     = storageUnits.find((u) => u._id === location.storageUnitId);
  const floorMap = unit     ? floorMaps.find((f) => f._id === unit.floorMapId) : null;
  const site     = floorMap ? sites.find((s) => s._id === floorMap.siteId)     : null;
  return [site?.name, floorMap?.name, unit?.name, location.name].filter(Boolean).join(' → ');
}

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting]           = useState(false);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockQty, setRestockQty]             = useState('');
  const [restockAssignments, setRestockAssignments] = useState([]);
  const [isRestocking, setIsRestocking]         = useState(false);

  const { loading, product, records, sites, floorMaps, storageUnits, storageLocations } =
    useTracker(() => {
      const subProducts  = Meteor.subscribe('products');
      const subRecords   = Meteor.subscribe('productRecords');
      const subLocations = Meteor.subscribe('locations.all');

      const loading = !subProducts.ready() || !subRecords.ready() || !subLocations.ready();

      return {
        loading,
        product:          Products.findOne(productId),
        records:          ProductRecords.find({ productId }, { sort: { quantity: -1 } }).fetch(),
        sites:            Sites.find().fetch(),
        floorMaps:        FloorMaps.find().fetch(),
        storageUnits:     StorageUnits.find().fetch(),
        storageLocations: StorageLocations.find().fetch(),
      };
    }, [productId]);

  if (loading) return <div style={{ padding: '24px' }}>Loading…</div>;
  if (!product) return <div style={{ padding: '24px' }}>Product not found.</div>;

  // Restock modal helpers

  function openRestockModal() {
    setRestockQty('');
    // Pre-populate with the current location assignments so the user can see
    // where stock already sits and decide where to put the new units.
    setRestockAssignments(
      records.map((r) => ({ locationId: r.locationId, quantity: String(r.quantity) }))
    );
    setIsRestocking(false);
    setShowRestockModal(true);
  }

  function addRestockAssignment() {
    setRestockAssignments([...restockAssignments, { locationId: '', quantity: '' }]);
  }

  function removeRestockAssignment(index) {
    setRestockAssignments(restockAssignments.filter((_, i) => i !== index));
  }

  function updateRestockAssignment(index, field, value) {
    setRestockAssignments(
      restockAssignments.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }

  // Derived validation for the restock modal.
  const parsedRestockQty    = parseInt(restockQty, 10);
  const restockQtyIsValid   = restockQty !== '' && !isNaN(parsedRestockQty) && parsedRestockQty > 0;
  const restockTargetTotal  = restockQtyIsValid ? product.totalQuantity + parsedRestockQty : null;

  const validRestockAssignments = restockAssignments.filter(
    (a) => a.locationId && a.quantity !== ''
  );
  const restockAssignedTotal = validRestockAssignments.reduce(
    (sum, a) => sum + parseInt(a.quantity, 10), 0
  );
  const restockRemaining = restockTargetTotal !== null ? restockTargetTotal - restockAssignedTotal : null;
  const restockIsBalanced = restockTargetTotal !== null && restockRemaining === 0;
  const canRestock = restockQtyIsValid && restockIsBalanced;

  async function confirmRestock() {
    setIsRestocking(true);
    try {
      await callMethod('products.restock', {
        productId,
        additionalQuantity: parsedRestockQty,
        assignments: validRestockAssignments.map((a) => ({
          locationId: a.locationId,
          quantity:   parseInt(a.quantity, 10),
        })),
      });
      setShowRestockModal(false);
    } catch (error) {
      console.error('Failed to restock product:', error);
      setIsRestocking(false);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '560px' }}>
      <button onClick={() => navigate('/')} style={buttonStyle}>← Back</button>

      <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '16px', marginBottom: '4px' }}>
        {product.name}
      </h1>

      {product.description && (
        <p style={{ color: '#555', marginBottom: '16px' }}>{product.description}</p>
      )}

      <p><strong>Total Stock:</strong> {product.totalQuantity}</p>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: '17px', fontWeight: 'bold', marginBottom: '12px' }}>
          Storage Locations
        </h2>

        {records.length === 0 ? (
          <p style={{ color: '#555' }}>No stock assigned to any location.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={thStyle}>Location</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  <td style={tdStyle}>
                    {buildLocationLabel(
                      record.locationId,
                      storageLocations,
                      storageUnits,
                      floorMaps,
                      sites
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{record.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ ...sectionStyle, display: 'flex', gap: '8px' }}>
        <button style={buttonStyle} onClick={() => navigate(`/inventory/${productId}/edit`)}>
          Edit
        </button>
        <button style={buttonStyle} onClick={openRestockModal}>
          Restock
        </button>
        <button style={dangerButtonStyle} onClick={() => setShowDeleteModal(true)}>
          Delete
        </button>
      </div>

      {/* Restock modal */}
      {showRestockModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: '500px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
              Restock "{product.name}"
            </h2>
            <p style={{ marginBottom: '16px', color: '#555', fontSize: '14px' }}>
              Current stock: <strong>{product.totalQuantity}</strong>. Enter how many units you are
              adding, then assign all stock (existing + new) to locations before saving.
            </p>

            {/* Units being added */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="restockQty" style={{ display: 'block', marginBottom: '4px' }}>
                <strong>Units being added</strong>
              </label>
              <input
                id="restockQty"
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                style={{ ...inputStyle, maxWidth: '140px' }}
                disabled={isRestocking}
              />
              {restockTargetTotal !== null && (
                <p style={{ ...warningStyle, marginTop: '6px' }}>
                  New total will be <strong>{restockTargetTotal}</strong> units.
                </p>
              )}
            </div>

            {/* Location assignments */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: '14px' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px' }}>
                Assign all stock to locations
              </p>

              {restockAssignments.map((assignment, index) => {
                const usedElsewhere = new Set(
                  restockAssignments
                    .filter((_, i) => i !== index)
                    .map((a) => a.locationId)
                    .filter(Boolean)
                );
                const availableLocations = storageLocations.filter(
                  (loc) => !usedElsewhere.has(loc._id)
                );

                return (
                  <div key={index} style={assignmentRowStyle}>
                    <select
                      value={assignment.locationId}
                      onChange={(e) => updateRestockAssignment(index, 'locationId', e.target.value)}
                      style={{ ...inputStyle, flex: 2 }}
                      disabled={isRestocking}
                    >
                      <option value="">Select a location…</option>
                      {availableLocations.map((loc) => (
                        <option key={loc._id} value={loc._id}>
                          {buildLocationLabel(loc._id, storageLocations, storageUnits, floorMaps, sites)}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={assignment.quantity}
                      onChange={(e) => updateRestockAssignment(index, 'quantity', e.target.value)}
                      style={{ ...inputStyle, flex: 1, maxWidth: '80px' }}
                      disabled={isRestocking}
                    />

                    <button
                      type="button"
                      onClick={() => removeRestockAssignment(index)}
                      style={buttonStyle}
                      disabled={isRestocking}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRestockAssignment}
                style={{ ...buttonStyle, marginTop: '4px' }}
                disabled={isRestocking}
              >
                + Add Location
              </button>

              {/* Stock balance indicator */}
              {restockRemaining !== null && (
                <p style={{ ...warningStyle, marginTop: '10px' }}>
                  {restockRemaining === 0 && `All ${restockTargetTotal} units assigned.`}
                  {restockRemaining  > 0 && `${restockAssignedTotal} of ${restockTargetTotal} assigned — ${restockRemaining} remaining.`}
                  {restockRemaining  < 0 && `Over-assigned by ${Math.abs(restockRemaining)} unit${Math.abs(restockRemaining) !== 1 ? 's' : ''}.`}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                style={{
                  ...buttonStyle,
                  opacity: canRestock && !isRestocking ? 1 : 0.4,
                  cursor:  canRestock && !isRestocking ? 'pointer' : 'not-allowed',
                }}
                disabled={!canRestock || isRestocking}
                onClick={confirmRestock}
              >
                {isRestocking ? 'Saving…' : 'Confirm Restock'}
              </button>
              <button
                style={buttonStyle}
                disabled={isRestocking}
                onClick={() => setShowRestockModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
              Delete "{product.name}"?
            </h2>
            <p style={{ marginBottom: '8px' }}>
              This will permanently delete the product and remove it from all{' '}
              <strong>{records.length} storage location{records.length !== 1 ? 's' : ''}</strong>{' '}
              it is currently assigned to.
            </p>
            <p style={{ marginBottom: '20px', fontStyle: 'italic', fontSize: '13px', color: '#555' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ ...dangerButtonStyle, opacity: isDeleting ? 0.4 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await callMethod('products.delete', { productId });
                    navigate('/');
                  } catch (error) {
                    console.error('Failed to delete product:', error);
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button
                style={buttonStyle}
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
