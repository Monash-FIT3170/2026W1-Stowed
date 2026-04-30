import { useParams, useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Products } from '/imports/api/products';
import { ProductRecords } from '/imports/api/productRecords';
import {
  Sites,
  FloorMaps,
  StorageUnits,
  StorageLocations,
} from '/imports/api/locations/collections';

// brief styling to be fixed later

const buttonStyle = {
  padding: '6px 14px',
  border: '1px solid #333',
  borderRadius: '3px',
  cursor: 'pointer',
  background: 'transparent',
  fontSize: '14px',
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

  return (
    <div style={{ padding: '24px', maxWidth: '560px' }}>
      <button onClick={() => navigate(-1)} style={buttonStyle}>← Back</button>

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
    </div>
  );
}
