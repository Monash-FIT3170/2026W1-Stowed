import { Meteor } from 'meteor/meteor';
import './Register.css';
import { ROLES } from 'imports/api/roles';
import React, { useState } from 'react';
import { useTracker } from 'meteor/react-meteor-data';

/**
 * Registration Page
 */
const Register = () => {

  const currentUser = useTracker(() => Meteor.user());

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(ROLES.STANDARD);

  const isLoggedIn = !!currentUser;
  const isPrivileged = currentUser?.profile?.role >= ROLES.ADMIN;

  const { username, email, password, confirmPassword } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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

      // self registration
      if (!isLoggedIn) {

        await Meteor.callAsync('users.register', {
          username,
          email,
          password,
        });

        setSuccess(`Account created for ${username}`);
      }

      // admin/owner creates user
      else if (isPrivileged) {

        await Meteor.callAsync('users.create', {
          username,
          email,
          password,
          role,
        });

        setSuccess(`User created: ${username}`);
      }

      // no allowed
      else {
        setError('You are not allowed to create users.');
        return;
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
    <div className="page">
      <div className="container">
        <h2>Create Account</h2>

        {error && <div className="status error">⚠ {error}</div>}
        {success && <div className="status success">✓ {success}</div>}

        <form onSubmit={onSubmit}>
          <div>
            <label>Username</label>
            <input name="username" value={username} onChange={onChange} required />
          </div>

          <div>
            <label>Email</label>
            <input name="email" value={email} onChange={onChange} required />
          </div>

          <div>
            <label>Password</label>
            <input type="password" name="password" value={password} onChange={onChange} required />
          </div>

          <div>
            <label>Confirm Password</label>
            <input type="password" name="confirmPassword" value={confirmPassword} onChange={onChange} required />
          </div>

          {isLoggedIn && isPrivileged && (
            <div>
              <p>User Type</p>

              <button type="button" onClick={() => setRole(ROLES.ADMIN)}
                className={role === ROLES.ADMIN ? 'active' : ''}>
                Admin
              </button>

              <button type="button" onClick={() => setRole(ROLES.STANDARD)}
                className={role === ROLES.STANDARD ? 'active' : ''}>
                Standard
              </button>
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

export { Register };