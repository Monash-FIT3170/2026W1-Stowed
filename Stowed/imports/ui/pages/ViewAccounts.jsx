import React, { useState, useMemo } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import { useNavigate } from "react-router-dom";
import "../Global.css";
import "./InventoryListPage.css";
import { ROLES } from "/imports/api/roles";

export function ViewAccounts() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { users, currentUser } = useTracker(() => {
    const subscription = Meteor.subscribe("allUsers");
    const users = Meteor.users.find({}, { fields: { emails: 1, "profile.role": 1, "profile.username": 1 } }).fetch();
    return { users, currentUser: Meteor.user(), ready: subscription.ready() };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      const username = (user.profile?.username || "").toLowerCase();
      const email = ((user.emails && user.emails[0]?.address) || "").toLowerCase();
      return username.includes(query) || email.includes(query);
    });
  }, [users, searchQuery]);

  const openDeleteModal = (userId) => {
    setUserToDelete(userId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(userToDelete);
    try {
      await Meteor.callAsync("users.delete", { userId: userToDelete });
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      alert(err.reason || "Deletion failed");
    } finally {
      setDeleting(null);
    }
  };

  const getEmail = (user) => (user.emails && user.emails[0]?.address) || "";

  const roleLabel = (roleValue) => {
    if (roleValue == null) return "";
    if (roleValue >= ROLES.OWNER) return "Owner";
    if (roleValue >= ROLES.ADMIN) return "Admin";
    if (roleValue >= ROLES.STANDARD) return "Standard";
    return "";
  };

  return (
    <div className="inventory-list-container">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Account management</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">All accounts</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Manage <em>Accounts</em></h1>
          <button onClick={() => navigate("/register")} className="btn-primary">
            + Create Account
          </button>
        </div>
      </div>

      <div style={{ padding: "0 28px 48px" }}>
        <div className="search-bar-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username or email"
            className="search-input"
            style={{ background: "var(--card-bg)" }}
          />
        </div>

        <div className="detail-section">
          <div style={{ padding: "16px 20px 0", marginBottom: "8px" }}>
            <div className="recent-items-title">All Accounts</div>
            <div className="recent-items-subtitle">{filteredUsers.length} of {users.length} accounts shown</div>
          </div>
          <div className="table-header" style={{ gridTemplateColumns: "1fr 2fr 1fr 100px" }}>
            <span>Username</span>
            <span>Email</span>
            <span>Role</span>
            <span></span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty-state">No accounts found.</div>
          ) : filteredUsers.map((user) => (
            <div key={user._id} className="table-row" style={{ gridTemplateColumns: "1fr 2fr 1fr 100px" }}>
              <span style={{ fontWeight: 500 }}>{user.profile?.username}</span>
              <span style={{ color: "var(--text-muted)" }}>{getEmail(user)}</span>
              <span>{roleLabel(user.profile?.role)}</span>
              <span>
                {user._id !== currentUser?._id && (
                  <button
                    onClick={() => openDeleteModal(user._id)}
                    disabled={deleting === user._id}
                    className="btn-danger"
                  >
                    {deleting === user._id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3 className="modal-title">Delete this account?</h3>
              <p className="modal-text">This will permanently delete the account. This action cannot be undone.</p>
              <div className="modal-actions">
                <button onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }} disabled={deleting !== null} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={confirmDelete} disabled={deleting !== null} className="btn-danger">
                  {deleting !== null ? "Deleting…" : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
