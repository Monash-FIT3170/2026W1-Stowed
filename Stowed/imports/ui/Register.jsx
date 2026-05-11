import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import './Register.css';

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
  const [role, setRole] = useState('user');

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
      const result = await Meteor.callAsync('users.register', { username, email, password, role });
      setSuccess(`Account created for ${result.username}`);
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.reason || 'Registration failed');
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
            <input type="text" name="username" value={username} onChange={onChange} required />
          </div>

          <div>
            <label>Email</label>
            <input type="email" name="email" value={email} onChange={onChange} required />
          </div>

          <div>
            <label>Password</label>
            <input type="password" name="password" value={password} onChange={onChange} required />
          </div>

          <div>
            <label>Confirm Password</label>
            <input type="password" name="confirmPassword" value={confirmPassword} onChange={onChange} required />
          </div>
          <div>
            <p>User Type</p>
            <button
              type="button" onClick={() => setRole('admin')} className={role === 'admin' ? 'active' : ''}
            >
              Admin
            </button>
            <button
              type="button" onClick={() => setRole('user')} className={role === 'user' ? 'active' : ''}
            >
              Standard
            </button>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

export { Register };