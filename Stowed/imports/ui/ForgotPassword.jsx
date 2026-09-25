import { useState } from "react";
import { Link } from "react-router-dom";
import { Accounts } from "meteor/accounts-base";
import "./Register.css";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    Accounts.forgotPassword({ email: email.trim() }, () => {
      setLoading(false);
      setSent(true);
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-solo">
        <p className="auth-kicker">Account access</p>
        <h2>Forgot password</h2>

        {sent ? (
          <>
            <p className="auth-card-text">
              If an account exists for {email}, a reset link is on its way. Check your inbox.
            </p>
            <p className="auth-switch">
              <Link to="/login">Back to login</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <p className="auth-card-text">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <label className="auth-field" htmlFor="email">
              <span>Email</span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="auth-input"
              />
            </label>

            <button type="submit" disabled={loading} className="auth-primary-button">
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <p className="auth-switch">
              <Link to="/login">Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};