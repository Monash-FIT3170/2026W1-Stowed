import React, { useState } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

export function ViewAccounts(){
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(null);

    const {users, currentUser} = useTracker(() => {
        const subscription = Meteor.subscribe('allUsers');
        const users = Meteor.users.find({}, {fields: {username: 1, emails: 1} }).fetch();
        return {users, currentUser: Meteor.user(), ready: subscription.ready() };
    }, []);

    const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    setDeleting(userId);
    try {
      await Meteor.callAsync('users.delete', { userId });
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
                    onClick={() => handleDelete(user._id)}
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
    </div>
  );
}