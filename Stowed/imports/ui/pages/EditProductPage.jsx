import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Products, ProductRecords } from '/imports/api/products/collections';
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from '/imports/api/locations/collections';

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

const warningStyle = {
  marginTop: '4px',
  fontStyle: 'italic',
  fontSize: '13px',
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
  maxWidth: '440px',
  width: '100%',
};

const changeRowStyle = {
  marginBottom: '10px',
  fontSize: '14px',
};

const thStyle = {
  padding: '6px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #ccc',
  fontSize: '13px',
};

const tdStyle = {
  padding: '6px 12px',
  fontSize: '13px',
};

function buildLocationLabel(location, storageUnits, floorMaps, sites) {
  const unit     = storageUnits.find((u) => u._id === location.storageUnitId);
  const floorMap = unit     ? floorMaps.find((f) => f._id === unit.floorMapId) : null;
  const site     = floorMap ? sites.find((s) => s._id === floorMap.siteId)     : null;
  return [site?.name, floorMap?.name, unit?.name, location.name].filter(Boolean).join(' → ');
}

export function EditProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [name, setName]                   = useState('');
  const [description, setDescription]     = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [assignments, setAssignments]     = useState([]);
  const [initialised, setInitialised]     = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving]           = useState(false);

  const { loading, product, originalRecords, sites, floorMaps, storageUnits, storageLocations } =
    useTracker(() => {
      const subProducts  = Meteor.subscribe('products');
      const subRecords   = Meteor.subscribe('productRecords');
      const subLocations = Meteor.subscribe('locations.all');

      const loading = !subProducts.ready() || !subRecords.ready() || !subLocations.ready();

      return {
        loading,
        product:         Products.findOne(productId),
        originalRecords: ProductRecords.find({ productId }, { sort: { quantity: -1 } }).fetch(),
        sites:           Sites.find().fetch(),
        floorMaps:       FloorMaps.find().fetch(),
        storageUnits:    StorageUnits.find().fetch(),
        storageLocations: StorageLocations.find().fetch(),
      };
    }, [productId]);

  // Populate form fields once data has loaded. The initialised flag prevents
  // reactive re-runs from resetting edits the user has already made.
  useEffect(() => {
    if (!loading && product && !initialised) {
      setName(product.name);
      setDescription(product.description || '');
      setTotalQuantity(String(product.totalQuantity));
      setAssignments(
        originalRecords.map((r) => ({ locationId: r.locationId, quantity: String(r.quantity) }))
      );
      setInitialised(true);
    }
  }, [loading, product, originalRecords, initialised]);

  // Derived validation (mirrors CreateProductPage)

  const parsedTotal = parseInt(totalQuantity, 10);

  const nameIsValid          = name.trim().length > 0;
  const totalQuantityIsValid = totalQuantity !== '' && !isNaN(parsedTotal);

  const validAssignments = assignments.filter((a) => a.locationId && a.quantity !== '');
  const assignedTotal    = validAssignments.reduce((sum, a) => sum + parseInt(a.quantity, 10), 0);
  const remaining        = totalQuantityIsValid ? parsedTotal - assignedTotal : null;
  const isBalanced       = totalQuantityIsValid && remaining === 0;

  const canSave = nameIsValid && totalQuantityIsValid && isBalanced;

  // Compute which fields have changed from the original saved values.
  // Assignments are compared order-independently by sorting on locationId.
  const changes = useMemo(() => {
    if (!initialised || !product) return {};

    const result = {};

    if (name.trim() !== product.name)
      result.name = { from: product.name, to: name.trim() };

    if (description !== (product.description || ''))
      result.description = { from: product.description || '', to: description };

    if (parsedTotal !== product.totalQuantity)
      result.totalQuantity = { from: product.totalQuantity, to: parsedTotal };

    const normalise = (arr) =>
      [...arr].sort((a, b) => a.locationId.localeCompare(b.locationId));

    const currentNorm  = normalise(
      validAssignments.map((a) => ({ locationId: a.locationId, quantity: parseInt(a.quantity, 10) }))
    );
    const originalNorm = normalise(
      originalRecords.map((r) => ({ locationId: r.locationId, quantity: r.quantity }))
    );

    const assignmentsChanged =
      currentNorm.length !== originalNorm.length ||
      currentNorm.some(
        (a, i) => a.locationId !== originalNorm[i].locationId || a.quantity !== originalNorm[i].quantity
      );

    if (assignmentsChanged) result.assignments = true;

    return result;
  }, [initialised, product, name, description, parsedTotal, validAssignments, originalRecords]);

  // Assignment handlers

  function addAssignment() {
    setAssignments([...assignments, { locationId: '', quantity: '' }]);
  }

  function removeAssignment(index) {
    setAssignments(assignments.filter((_, i) => i !== index));
  }

  function updateAssignment(index, field, value) {
    setAssignments(assignments.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function handleSave() {
    if (Object.keys(changes).length === 0) {
      // Nothing changed — skip the modal and go straight back.
      navigate(`/inventory/${productId}`);
      return;
    }
    setShowSaveModal(true);
  }

  async function confirmSave() {
    setIsSaving(true);
    try {
      await callMethod('products.update', {
        productId,
        name: name.trim(),
        description,
        totalQuantity: parsedTotal,
        assignments: validAssignments.map((a) => ({
          locationId: a.locationId,
          quantity:   parseInt(a.quantity, 10),
        })),
      });
      navigate(`/inventory/${productId}`);
    } catch (error) {
      console.error('Failed to update product:', error);
      setIsSaving(false);
    }
  }

  if (loading || !initialised) return <div style={{ padding: '24px' }}>Loading…</div>;
  if (!product) return <div style={{ padding: '24px' }}>Product not found.</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '560px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>Edit Product</h1>
      <p style={{ marginBottom: '24px', color: '#555' }}>
        Update the product details below.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

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

        {}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', marginBottom: '4px' }}>
            Storage Locations
          </h2>
          <p style={{ marginBottom: '16px', color: '#555' }}>
            All stock must be assigned before saving.
          </p>

          {assignments.map((assignment, index) => {
            // Locations already chosen by other rows (not this one).
            const usedElsewhere = new Set(
              assignments
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
                onChange={(e) => updateAssignment(index, 'locationId', e.target.value)}
                style={{ ...inputStyle, flex: 2 }}
              >
                <option value="">Select a location…</option>
                {availableLocations.map((location) => (
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
            );
          })}

          <button
            type="button"
            onClick={addAssignment}
            style={{ ...buttonStyle, marginTop: '4px' }}
          >
            + Add Location
          </button>

          {}
          {remaining !== null && (
            <p style={{ ...warningStyle, marginTop: '12px' }}>
              {remaining === 0 && `All ${parsedTotal} units assigned.`}
              {remaining  > 0 && `${assignedTotal} of ${parsedTotal} assigned — ${remaining} remaining.`}
              {remaining  < 0 && `Over-assigned by ${Math.abs(remaining)} unit${Math.abs(remaining) !== 1 ? 's' : ''}.`}
            </p>
          )}
        </div>

        {}
        <div style={{ ...sectionStyle, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={!canSave}
            style={{
              ...buttonStyle,
              opacity: canSave ? 1 : 0.4,
              cursor:  canSave ? 'pointer' : 'not-allowed',
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => navigate(`/inventory/${productId}`)}
            style={buttonStyle}
          >
            Cancel
          </button>
        </div>

      </form>

      {/* ── Save confirmation modal ── */}
      {showSaveModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
              Save changes?
            </h2>
            <p style={{ marginBottom: '16px', color: '#555', fontSize: '14px' }}>
              The following fields will be updated:
            </p>

            {changes.name && (
              <div style={changeRowStyle}>
                <strong>Name</strong>
                <div style={{ color: '#555' }}>
                  {changes.name.from} → {changes.name.to}
                </div>
              </div>
            )}

            {changes.description !== undefined && (
              <div style={changeRowStyle}>
                <strong>Description</strong>
                <div style={{ color: '#555' }}>
                  {changes.description.from || '(none)'} → {changes.description.to || '(none)'}
                </div>
              </div>
            )}

            {changes.totalQuantity && (
              <div style={changeRowStyle}>
                <strong>Total Quantity</strong>
                <div style={{ color: '#555' }}>
                  {changes.totalQuantity.from} → {changes.totalQuantity.to}
                </div>
              </div>
            )}

            {changes.assignments && (
              <div style={changeRowStyle}>
                <strong>Storage Locations</strong>
                <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '6px' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Location</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validAssignments.map((a, i) => {
                      const loc = storageLocations.find((l) => l._id === a.locationId);
                      const label = loc
                        ? buildLocationLabel(loc, storageUnits, floorMaps, sites)
                        : a.locationId;
                      return (
                        <tr key={i}>
                          <td style={tdStyle}>{label}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{a.quantity}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                style={{
                  ...buttonStyle,
                  opacity: isSaving ? 0.4 : 1,
                  cursor:  isSaving ? 'not-allowed' : 'pointer',
                }}
                disabled={isSaving}
                onClick={confirmSave}
              >
                {isSaving ? 'Saving…' : 'Confirm Save'}
              </button>
              <button
                style={buttonStyle}
                disabled={isSaving}
                onClick={() => setShowSaveModal(false)}
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
