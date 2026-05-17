import React, { useState, useMemo } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';
import './ViewAccounts.css';

export function ViewAccounts(){
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const {users, currentUser} = useTracker(() => {
        const subscription = Meteor.subscribe('allUsers');
        const users = Meteor.users.find({}, {fields: {username: 1, emails: 1} }).fetch();
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

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Username</th>
            <th className="text-left py-2">Email</th>
            <th className="text-left py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user._id} className="border-b">
              <td className="py-2">{user.username}</td>
              <td className="py-2">{getEmail(user)}</td>
              <td className="py-2">
                {user._id !== currentUser._id && (
                  <button
                    onClick={() => openDeleteModal(user._id)}
                    disabled={deleting === user._id}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deleting === user._id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(36,20,15,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#fffaf8",
              border: "1px solid rgba(36,20,15,0.08)",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 10px 40px rgba(36,20,15,0.15)",
              fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "12px",
                fontSize: "20px",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontWeight: 700,
                color: "#24140f",
              }}
            >
              Delete this account?
            </h3>
            <p style={{ marginBottom: "28px", color: "#6b4f46", lineHeight: 1.5 }}>
              This will permanently delete the account. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                disabled={deleting !== null}
                style={{
                  padding: "10px 22px",
                  background: "#fffaf8",
                  border: "1px solid rgba(36,20,15,0.12)",
                  borderRadius: "999px",
                  color: "#24140f",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting !== null}
                style={{
                  padding: "10px 22px",
                  background: "#e76a54",
                  border: "1px solid #e76a54",
                  borderRadius: "999px",
                  color: "#fffaf8",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                {deleting !== null ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}