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

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Total Stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product._id}>
              <td>{product.name}</td>
              <td>{product.description}</td>
              <td>{product.totalQuantity}</td>
              <td>
                <button type="button">More</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
