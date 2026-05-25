import React from "react";
import { Link } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products } from "../../api/products/collections";
import { ProductThumbnail } from "../components/ProductThumbnail";
import { StatusBadge } from "../components/StatusBadge";
import "./InventoryPage.css";
import "../Global.css";

export function InventoryPage() {
  const { items, loading, username } = useTracker(() => {
    const sub = Meteor.subscribe("products");
    return {
      items: Products.find().fetch(),
      loading: !sub.ready(),
      username: Meteor.user()?.profile?.username,
    };
  }, []);

  if (loading) {
    return <div className="inventory-page-container">Loading...</div>;
  }

  const totalItems = items.length;
  const lowStockCount = items.filter((item) => item.reorderAt != null && item.totalQuantity <= item.reorderAt).length;
  const totalValue = items.reduce((sum, item) => sum + (item.unitCost * item.totalQuantity || 0), 0);
  const recentItems = items.slice(0, 5);

  return (
    <div className="inventory-page-container">
      <div className="breadcrumb">
        <span className="breadcrumb-link">Inventory</span>
        {" "}&nbsp;/{" "}&nbsp;
        <span className="breadcrumb-current">Dashboard</span>
      </div>
      <h1 className="page-heading">Hello, {username || "User"}</h1>
      <h2 className="page-subheading">Here's what's stocked.</h2>
      <div className="stats-container">
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
      </div>
      <div className="recent-items-card">
        <div className="recent-items-header">
          <div>
            <div className="recent-items-title">Recently updated</div>
            <div className="recent-items-subtitle">
              {recentItems.length} of {totalItems} products shown
            </div>
          </div>
          <Link to="/inventory/list" className="view-all-link">
            View all →
          </Link>
        </div>

        {recentItems.map((item) => (
          <div key={item._id} className="table-row">
            <ProductThumbnail images={item.images || item.catalogImages} photoUrl={item.photoUrl} name={item.name} />
            <span>
              <Link to={`/inventory/${item._id}`} className="item-name-link">
                {item.name}
              </Link>
            </span>
            <span>
              {item.totalQuantity}
            </span>
            <StatusBadge
              quantity={item.totalQuantity}
              threshold={item.reorderAt != null ? item.reorderAt : null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
