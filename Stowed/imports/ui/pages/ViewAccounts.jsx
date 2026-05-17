import React, { useState } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

export function ViewAccounts(){
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    const {users, currentUser} = useTracker(() => {
        const subscription = Meteor.subscribe('allUsers');
        const users = Meteor.users.find({}, {fields: {username: 1, emails: 1} }).fetch();
        return {users, currentUser: Meteor.user(), ready: subscription.ready() };
    }, []);

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
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Manage Accounts</h2>
        {/* Create Account button links to the existing registration page */}
        <button
          onClick={() => navigate('/register')}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          + Create Account
        </button>
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
          {users.map((user) => (
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
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '6px',
            padding: '28px',
            maxWidth: '400px',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>
            Delete this account?
          </h3>
          <p style={{ marginBottom: '24px', color: '#666' }}>
            This will permanently delete the account. This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setUserToDelete(null);
              }}
              disabled={deleting !== null}
              style={{
                padding: '6px 14px',
                border: '1px solid #333',
                borderRadius: '3px',
                cursor: 'pointer',
                background: 'transparent',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting !== null}
              style={{
                padding: '6px 14px',
                border: '1px solid #c00',
                color: '#c00',
                borderRadius: '3px',
                cursor: 'pointer',
                background: 'transparent',
                fontSize: '14px',
              }}
            >
              {deleting !== null ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}