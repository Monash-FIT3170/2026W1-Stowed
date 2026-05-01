import { Link } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Products } from '/imports/api/products';

export function InventoryPage() {
  const products = useTracker(() => {
    Meteor.subscribe('products');
    return Products.find({}, { sort: { createdAt: 1 } }).fetch();
  }, []);

  return (
    <div>
      <Link to="/inventory/new">
        <button>New Product</button>
      </Link>

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ padding: '8px 16px', textAlign: 'left' }}>Name</th>
            <th style={{ padding: '8px 16px', textAlign: 'left' }}>Description</th>
            <th style={{ padding: '8px 16px', textAlign: 'left' }}>Total Stock</th>
            <th style={{ padding: '8px 16px' }}></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product._id}>
              <td style={{ padding: '8px 16px' }}>{product.name}</td>
              <td style={{ padding: '8px 16px' }}>{product.description}</td>
              <td style={{ padding: '8px 16px' }}>{product.totalQuantity}</td>
              <td style={{ padding: '8px 16px' }}>
                <Link to={`/inventory/${product._id}`}>
                  <button type="button">More</button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
