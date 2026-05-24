import React, { useState, useMemo } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';
import '../Global.css';
import './InventoryListPage.css';

export function ViewAccounts() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { users, currentUser } = useTracker(() => {
    const subscription = Meteor.subscribe('allUsers');
    const users = Meteor.users.find({}, { fields: { username: 1, emails: 1 } }).fetch();
    return { users, currentUser: Meteor.user(), ready: subscription.ready() };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      const username = (user.username || '').toLowerCase();
      const email = ((user.emails && user.emails[0]?.address) || '').toLowerCase();
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
      await Meteor.callAsync('users.delete', { userId: userToDelete });
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      alert(err.reason || 'Deletion failed');
    } finally {
      setDeleting(null);
    }
  };

  const getEmail = (user) => (user.emails && user.emails[0]?.address) || '';

  return (
    <div className="inventory-list-container">
      <div className="item-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Account management</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">All accounts</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Manage <em>Accounts</em></h1>
          <button onClick={() => navigate('/register')} className="btn-primary">
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
            style={{ background: "#ffffff" }}
          />
        </div>

        <div className="filter-count">
          Showing {filteredUsers.length} of {users.length}
        </div>

        <div className="table-header" style={{ gridTemplateColumns: "1fr 2fr 100px" }}>
          <span>Username</span>
          <span>Email</span>
          <span>Actions</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="empty-state">No accounts found.</div>
        ) : filteredUsers.map((user) => (
          <div key={user._id} className="table-row" style={{ gridTemplateColumns: "1fr 2fr 100px" }}>
            <span style={{ fontWeight: 500 }}>{user.username}</span>
            <span style={{ color: "var(--text-muted)" }}>{getEmail(user)}</span>
            <span>
              {user._id !== currentUser._id && (
                <button
                  onClick={() => openDeleteModal(user._id)}
                  disabled={deleting === user._id}
                  className="btn-danger"
                >
                  {deleting === user._id ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </span>
          </div>
        ))}

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
                  {deleting !== null ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}