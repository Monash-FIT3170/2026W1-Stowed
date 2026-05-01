import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const { username, email, password, confirmPassword } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!/^.+@.+\..+$/.test(email)) {
      setError('Please enter a valid email.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Call the method registered on the server
      const result = await Meteor.callAsync('users.register', { username, email, password, isAdmin });
      setSuccess(`Account created for ${result.username}. You can now log in.`);
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.reason || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Create Account</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            name="username"
            value={username}
            onChange={onChange}
            required
            className="w-full border border-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={email}
            onChange={onChange}
            required
            className="w-full border border-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            value={password}
            onChange={onChange}
            required
            className="w-full border border-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={onChange}
            required
            className="w-full border border-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
{/* role selection for new account */}
        <div>
          <p>User Type</p>
          <button
            type="button"
            onClick={() => setIsAdmin(true)}
            style={{
              backgroundColor: !isAdmin ? 'white' : '#A7C7E7',
              marginRight: '10px'
              
            }}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => setIsAdmin(false)}
            style={{
              backgroundColor: isAdmin ? 'white' : '#A7C7E7',
            }}
          >
            Standard
          </button>
        </div>

        <button type="submit" disabled={loading}
        className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export { Register };