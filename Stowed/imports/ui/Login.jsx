import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

/**
 * Login Page
 */
export const Login = () => {
    // stores input
  const [login, setLogin] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // handles form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // basic frontend validation
    if (!login.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    // log in logic
    try {
      const isEmail = login.includes('@');
      await new Promise((resolve, reject) => {
        Meteor.loginWithPassword(
          isEmail ? login : { username: login },
          password,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      navigate('/');

    } catch (err) {
      setError(err.reason || err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full p-4">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Log In</h2>

        {error && <p className="text-red-600 mb-2">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login" className="block text-sm font-medium mb-1">
              Email or Username
            </label>

            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              className="w-full border border-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};