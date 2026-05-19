import { Meteor } from 'meteor/meteor';
import './Register.css';
import { ROLES } from 'imports/api/roles';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasClientPermission } from '../api/userMethods';
import { useAuth } from '../api/useAuth';

/**
 * Registration Page 
 */
const Register = () => {
  const navigate = useNavigate();

  // stores all form input values
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [roleState, setRoleState] = useState(ROLES.STANDARD);
  const [orgCode, setOrgCode] = useState('');

  // get details of current user
  const { isLoggedIn, role } = useAuth();
  const isPrivileged = hasClientPermission(role, "create-users");

  const { username, email, password, confirmPassword } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // handles form submission
  const onSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!/^.+@.+\..+$/.test(email)) {
      setError('Invalid email format');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {


      // admin/owner creates user
      if (isPrivileged) {

        await Meteor.callAsync('users.create', {
          username,
          email,
          password,
          role: roleState,
        });

        setSuccess(`User created: ${username}`);
      }
      // self registration
      else {

        await Meteor.callAsync('users.register', {
          username,
          email,
          password,
          orgCode: orgCode.trim() || null,
        });

        setSuccess(`Account created for ${username}`);
      }

      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
      });

    } catch (err) {
      setError(err.reason || err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

   return (
    <div className="auth-page">
      <section className="auth-shell" aria-label="Create account">
        <div className="auth-brand-panel">
          <p className="auth-kicker">Stocktake / Users</p>
          <h1>{isPrivileged ? 'Add a team member' : 'Start mapping with Stowed'}</h1>
          <p>
            Give people access to manage items, update stock counts, and maintain storage locations.
          </p>
          <ul className="auth-feature-list">
            <li>Shop and home floor layouts</li>
            <li>QR labels for fast item lookup</li>
            <li>Shopping lists from stock needs</li>
          </ul>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <div>
              <p className="auth-kicker">Account setup</p> 
              <h2>Create Account</h2>
            </div>

        {!isLoggedIn && (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="auth-link-button">
                Back to login
              </button>
            )}
          </div>

          {error && <div className="auth-status auth-status-error">{error}</div>}
          {success && <div className="auth-status auth-status-success">{success}</div>}

          <form onSubmit={onSubmit} className="auth-form">
            
           <label  className="auth-field">
             <span>Organisation Code</span>
              <input
                type="text"
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value)}
                className="auth-input"
              />
           </label>
            <label className="auth-field">
              <span>Username</span>
              <input className="auth-input" name="username" value={username} onChange={onChange} required />
            </label>

            <label className="auth-field">
              <span>Email</span>
              <input className="auth-input" name="email" value={email} onChange={onChange} required />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input className="auth-input" type="password" name="password" value={password} onChange={onChange} required />
            </label>

            <label className="auth-field">
              <span>Confirm Password</span>
              <input className="auth-input" type="password" name="confirmPassword" value={confirmPassword} onChange={onChange} required />
            </label>

            {isLoggedIn && isPrivileged && (
              <div className="auth-role-group">
                <p>User Type</p>

                <div className="auth-segmented-control">
                  <button type="button" onClick={() => setRoleState(ROLES.ADMIN)}
                    className={role === ROLES.ADMIN ? 'active' : ''}>
                    Admin
                  </button>

                  <button type="button" onClick={() => setroleState(ROLES.STANDARD)}
                    className={role === ROLES.STANDARD ? 'active' : ''}>
                    Standard
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-primary-button">
              {loading ? 'Creating...' : 'Register'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export { Register };
