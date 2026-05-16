import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import './Register.css';

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
    <div className="auth-page">
      <section className="auth-shell" aria-label="Login">
        <div className="auth-brand-panel">
          <p className="auth-kicker">Stocktake / Floor maps</p>
          <h1>Welcome back to <span>Stowed</span></h1>
          <p>
            Map your shop or home storage, scan QR labels, and keep every item easy to find.
          </p>
          <ul className="auth-feature-list">
            <li>Storage units and item locations</li>
            <li>Low-stock visual alerts</li>
            <li>Photo-based item catalogue</li>
          </ul>
        </div>

        <div className="auth-card">
          <p className="auth-kicker">Account access</p>
          <h2>Log in</h2>

          {error && <p className="auth-status auth-status-error">{error}</p>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field" htmlFor="login">
              <span>Email or Username</span>
              <input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className="auth-input"
              />
            </label>

            <label className="auth-field" htmlFor="password">
              <span>Password</span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="auth-input"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="auth-primary-button">
              {loading ? 'Logging in...' : 'Log In'}
            </button>

            <p className="auth-switch">
              Need an account? <Link to="/register">Create Account</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
};
