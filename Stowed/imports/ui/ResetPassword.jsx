import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Accounts } from "meteor/accounts-base";
import "./Register.css";

export const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    Accounts.resetPassword(token, password, (err) => {
      setLoading(false);
      if (err) {
        setError("This reset link is invalid or has expired. Request a new one.");
        return;
      }
      navigate("/dashboard", { replace: true });
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-solo">
        <p className="auth-kicker">Account access</p>
        <h2>Choose a new password</h2>

        {error && <p className="auth-status auth-status-error">{error}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field" htmlFor="password">
            <span className="auth-field-row">
              New Password
              <button
                type="button"
                className="auth-show-toggle"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="auth-input"
            />
          </label>

          <label className="auth-field" htmlFor="confirm">
            <span className="auth-field-row">
              Confirm Password
              <button
                type="button"
                className="auth-show-toggle"
                onClick={() => setShowConfirm((s) => !s)}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </span>
            <input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="auth-input"
            />
          </label>

          <button type="submit" disabled={loading} className="auth-primary-button">
            {loading ? "Saving..." : "Reset password"}
          </button>

          <p className="auth-switch">
            <Link to="/forgot-password">Request a new link</Link>
          </p>
        </form>
      </div>
    </div>
  );
};