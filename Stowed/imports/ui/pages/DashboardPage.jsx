import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products } from "../../api/products/collections";
import { DashboardWidget } from "../components/DashboardWidget";
import { ProductThumbnail } from "../components/ProductThumbnail";
import { StatusBadge } from "../components/StatusBadge";
import "./DashboardPage.css";
import "../Global.css";

export function DashboardPage() {
  const { items, loading, username } = useTracker(() => {
    const sub = Meteor.subscribe("products");
    return {
      items: Products.find().fetch(),
      loading: !sub.ready(),
      username: Meteor.user()?.profile?.username,
    };
  }, []);

  const totalItems = items.length;
  const lowStockCount = items.filter(
    (item) => item.reorderAt != null && item.totalQuantity <= item.reorderAt,
  ).length;
  const totalValue = items.reduce(
    (sum, item) => sum + (item.unitCost * item.totalQuantity || 0),
    0,
  );
  const recentItems = items.slice(0, 5);

  return (
    <div className="dashboard-page-container">
      <div className="breadcrumb">
        <span className="breadcrumb-current">Dashboard</span>
      </div>
      <h1 className="dashboard-page-heading">Hello, {username || "User"}</h1>
      <p className="dashboard-page-subheading">Here&apos;s what&apos;s stocked.</p>

      {loading ? (
        <div className="dashboard-loading" role="status">
          Loading dashboard…
        </div>
      ) : (
        <div className="dashboard-grid">
          <section className="dashboard-metrics dashboard-grid-full" aria-label="Inventory metrics">
            <div className="stat-card stat-card-green">
              <div className="stat-value">{totalItems}</div>
              <div className="stat-label stat-label-green">Products tracked</div>
            </div>

            <div className="stat-card stat-card-orange">
              <div className="stat-value">{lowStockCount}</div>
              <div className="stat-label stat-label-orange">Low stock</div>
            </div>

            <div className="stat-card stat-card-yellow">
              <div className="stat-value">${totalValue.toLocaleString()}</div>
              <div className="stat-label stat-label-yellow">Total value</div>
            </div>
          </section>

          <DashboardWidget
            title="Recently updated"
            subtitle={`${recentItems.length} of ${totalItems} products shown`}
            action={
              <Link to="/inventory/list" className="dashboard-action-link">
                View all →
              </Link>
            }
            className="dashboard-grid-full"
          >
            {recentItems.length > 0 ? (
              recentItems.map((item) => (
                <div key={item._id} className="dashboard-recent-row">
                  <ProductThumbnail
                    images={item.images || item.catalogImages}
                    photoUrl={item.photoUrl}
                    name={item.name}
                  />
                  <span>
                    <Link to={`/inventory/${item._id}`} className="item-name-link">
                      {item.name}
                    </Link>
                  </span>
                  <span>{item.totalQuantity}</span>
                  <StatusBadge
                    quantity={item.totalQuantity}
                    threshold={item.reorderAt != null ? item.reorderAt : null}
                  />
                </div>
              ))
            ) : (
              <p className="dashboard-empty-state">No products have been added yet.</p>
            )}
          </DashboardWidget>
        </div>
      )}
    </div>
  );
}
