import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import './Register.css';

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

    // Compound the username with the org code so Meteor can find the globally-unique account
    const identifier = login.includes('@')
      ? login
      : { username: `${orgCode.trim().toLowerCase()}~${login.trim()}` };

    await new Promise((resolve, reject) => {
      Meteor.loginWithPassword(identifier, password, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
      navigate('/');
    } catch (err) {
      const reason = err.reason || err.message || '';
      if (reason.toLowerCase().includes('incorrect password')) {
        setError('Incorrect password. Please try again.');
      } else if (reason.toLowerCase().includes('user not found') || reason.toLowerCase().includes('no user')) {
        setError('No account found with those details.');
      } else if (err.error === 'too-many-requests') {
        setError('Too many attempts. Please wait a moment before trying again.');
      } else {
        setError('Login failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-shell" aria-label="Login">
        <div className="auth-brand-panel">
          <p className="auth-kicker">Stocktake / Floor maps</p>
          <h1>Welcome back to <em>Stowed</em></h1>
          <p>
            Map your shop or home storage, scan QR labels, and keep every product easy to find.
          </p>
          <ul className="auth-feature-list">
            <li>Storage units and product locations</li>
            <li>Low-stock visual alerts</li>
            <li>Photo-based product catalogue</li>
          </ul>
        </div>

        <div className="auth-card">
          <p className="auth-kicker">Account access</p>
          <h2>Log in</h2>

          {error && <p className="auth-status auth-status-error">{error}</p>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field" htmlFor="orgCode">
              <span>Organisation Code</span>
              <input
                id="orgCode"
                type="text"
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value)}
                required
                autoComplete="organization"
                className="auth-input"
              />
            </label>
            
            <label className="auth-field" htmlFor="login">
              <span>Email or Username</span>
              <input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoComplete="username"
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
                autoComplete="current-password"
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
              New to Stowed? <Link to="/register">Set up your organisation</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
};
