import { Link } from 'react-router-dom';

export function InventoryPage() {
  return (
    <div>
      <Link to="/inventory/new">
        <button>New Product</button>
      </Link>
    </div>
  );
}
