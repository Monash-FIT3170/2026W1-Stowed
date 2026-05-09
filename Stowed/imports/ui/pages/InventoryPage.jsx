import React from "react";
import { Link } from "react-router-dom";
import { mockUser } from "../../api/mockUser";
import {
  mockItems,
  getLowStockItems,
  getTotalValue,
  getRecentlyUpdatedItems,
} from "../../api/mockItems";
import { ItemThumbnail } from "../components/ItemThumbnail";
import { StatusBadge } from "../components/StatusBadge";
import "./InventoryPage.css";

export function InventoryPage() {
  const totalItems = mockItems.length;
  const lowStockCount = getLowStockItems(mockItems).length;
  const totalValue = getTotalValue(mockItems);
  const recentItems = getRecentlyUpdatedItems(mockItems);

  return (
    <div className="inventory-page-container">
      Inventory Page
      <h1 className="page-heading">Hello, {mockUser.name}</h1>
      <h2 className="page-subheading">Here's what's stocked.</h2>
      <div className="stats-container">
        <div className="stat-card stat-card-green">
          <div className="stat-value">{totalItems}</div>
          <div className="stat-label stat-label-green">Items tracked</div>
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
              {recentItems.length} of {mockItems.length} items shown
            </div>
          </div>
          <Link to="/inventory/list" className="view-all-link">
            View all →
          </Link>
        </div>

        {recentItems.map((item) => (
          <div key={item._id} className="table-row">
            <ItemThumbnail photoUrl={item.photoUrl} name={item.name} />
            <span>
              <Link to={`/inventory/${item._id}`} className="item-name-link">
                {item.name}
              </Link>
            </span>
            <span>
              <span className="item-tag">{item.tag || "—"}</span>
            </span>
            <span className="item-location">{item.location}</span>
            <span>
              {item.quantity}/{item.lowStockThreshold}
            </span>
            <StatusBadge
              quantity={item.quantity}
              threshold={item.lowStockThreshold}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
