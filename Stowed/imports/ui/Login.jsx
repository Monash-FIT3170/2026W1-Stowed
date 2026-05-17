import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate, Link } from 'react-router-dom';

/**
 * Login Page
 */
export const Login = () => {
  const [orgCode, setOrgCode] = useState('');      // organisation code
  const [login, setLogin] = useState('');          // email or username
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 1. Organisation required first
    if (!orgCode.trim()) {
      setError('Please enter your organisation code.');
      return;
    }

    // 2. Other fields
    if (!login.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
    await Meteor.callAsync('users.checkOrganisation', {
      orgCode: orgCode.trim(),
      login: login.trim(),
    });

    await new Promise((resolve, reject) => {
      Meteor.loginWithPassword(
        login.includes('@') ? login : { username: login },
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
          {/* Organisation Code */}
          <div>
            <label htmlFor="orgCode" className="block text-sm font-medium mb-1">
              Organisation Code
            </label>
            <input
              id="orgCode"
              type="text"
              value={orgCode}
              onChange={(e) => setOrgCode(e.target.value)}
              required
              className="w-full border border-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email or Username */}
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

          {/* Password */}
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

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">Don’t have an account?</p>
            <Link to="/register" className="inline-block mt-2 text-blue-600 hover:underline">
              Create Account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};