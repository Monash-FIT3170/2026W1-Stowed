import React, { useState, useMemo } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';
import './ViewAccounts.css';
import { ROLES } from '/imports/api/roles';

export function ViewAccounts(){
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const {users, currentUser} = useTracker(() => {
        const subscription = Meteor.subscribe('allUsers');
        const users = Meteor.users.find({}, {fields: {username: 1, emails: 1, 'profile.role': 1} }).fetch();
        return {users, currentUser: Meteor.user(), ready: subscription.ready() };
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
  const roleLabel = (roleValue) => {
  if (roleValue == null) return '';
  if (roleValue >= ROLES.OWNER) return 'Owner';
  if (roleValue >= ROLES.ADMIN) return 'Admin';
  if (roleValue >= ROLES.STANDARD) return 'Standard';
  return '';
  };
  return (
    <div className="view-accounts-container">
      <div className="breadcrumb">Account management / All accounts</div>
      <h1 className="page-title">
        Manage <em>accounts</em>
      </h1>
      <div className="search-bar-container">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username or email"
          className="search-input"
        />
        <button
          onClick={() => navigate('/register')}
          className="btn-add-item"
        >
          + Create Account
        </button>
      </div>

      <div className="search-result-count">
        Showing {filteredUsers.length} of {users.length}
      </div>

      <div className="table-header">
        <span>Username</span>
        <span>Email</span>
        <span>Role</span>
        <span>Actions</span>
      </div>

      {filteredUsers.map((user) => (
        <div key={user._id} className="table-row">
          <span>{user.username}</span>
          <span className="cell-email">{getEmail(user)}</span>
          <span>{roleLabel(user.profile?.role)}</span>
          <span>
            {user._id !== currentUser._id && (
              <button
                onClick={() => openDeleteModal(user._id)}
                disabled={deleting === user._id}
                className="btn-row-delete"
              >
                {deleting === user._id ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </span>
        </div>
      ))}
      {showDeleteModal && (
        <div className="view-accounts-modal-overlay">
          <div className="view-accounts-modal">
            <h3>Delete this account?</h3>
            <p>This will permanently delete the account. This action cannot be undone.</p>
            <div className="view-accounts-modal-actions">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                disabled={deleting !== null}
                className="view-accounts-btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting !== null}
                className="view-accounts-btn-confirm"
              >
                {deleting !== null ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}