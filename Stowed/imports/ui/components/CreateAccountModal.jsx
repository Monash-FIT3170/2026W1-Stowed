import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import "../Register.css";
import { ROLES } from "/imports/api/roles";
import { SERVER_ERROR_FIELDS, validateAccountField } from "../accountValidation";

const EMPTY_FORM = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const FIELDS = ["username", "email", "password", "confirmPassword"];

/**
 * Modal for an owner to create a team member account in their organisation.
 */
export function CreateAccountModal({ onClose }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [roleState, setRoleState] = useState(ROLES.STANDARD);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { username, email, password, confirmPassword } = formData;

  // close on Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const setFieldError = (field, message) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  // clear a field's error once the user fixes it
  const revalidateIfShown = (field, values) => {
    if (fieldErrors[field]) setFieldError(field, validateAccountField(field, values));
  };

  const onChange = (e) => {
    const next = { ...formData, [e.target.name]: e.target.value };
    setFormData(next);
    revalidateIfShown(e.target.name, next);
    if (e.target.name === "password") revalidateIfShown("confirmPassword", next);
  };

  const fieldProps = (field) => ({
    onBlur: () => setFieldError(field, validateAccountField(field, formData)),
    "aria-invalid": fieldErrors[field] ? "true" : undefined,
    "aria-describedby": fieldErrors[field] ? `create-${field}-error` : undefined,
  });

  const renderFieldError = (field) =>
    fieldErrors[field] ? (
      <span id={`create-${field}-error`} className="auth-field-error" role="alert">
        {fieldErrors[field]}
      </span>
    ) : null;

  const onSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    FIELDS.forEach((field) => {
      const message = validateAccountField(field, formData);
      if (message) errors[field] = message;
    });
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await Meteor.callAsync("users.create", { username, email, password, role: roleState });
      setSuccess(`User created: ${username}. A verification email has been sent to ${email}.`);
      setFormData(EMPTY_FORM);
    } catch (err) {
      const message = err.reason || err.message || "Operation failed";
      const field = SERVER_ERROR_FIELDS[err.error];
      if (field) {
        setFieldError(field, message);
        setError("Please fix the highlighted fields.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={{ maxWidth: "480px", width: "100%" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="create-account-modal-title" className="modal-title">
          Add a team member
        </h3>
        <p className="modal-text">
          Give people access to manage products, update stock counts, and maintain storage
          locations.
        </p>

        {error && (
          <div className="auth-status auth-status-error" role="alert">
            {error}
          </div>
        )}
        {success && <div className="auth-status auth-status-success">{success}</div>}

        <form onSubmit={onSubmit} className="auth-form" noValidate>
          <label className="auth-field">
            <span>Username</span>
            <input
              className="auth-input"
              name="username"
              value={username}
              onChange={onChange}
              required
              {...fieldProps("username")}
            />
            {renderFieldError("username")}
          </label>

          <label className="auth-field">
            <span>Email</span>
            <input
              className="auth-input"
              name="email"
              value={email}
              onChange={onChange}
              required
              {...fieldProps("email")}
            />
            {renderFieldError("email")}
          </label>

          <label className="auth-field">
            <span className="auth-field-row">
              Password
              <button
                type="button"
                className="auth-show-toggle"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
            <input
              className="auth-input"
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={onChange}
              required
              {...fieldProps("password")}
            />
            {renderFieldError("password")}
          </label>

          <label className="auth-field">
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
              className="auth-input"
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              value={confirmPassword}
              onChange={onChange}
              required
              {...fieldProps("confirmPassword")}
            />
            {renderFieldError("confirmPassword")}
          </label>

          <div className="auth-role-group">
            <p>User Type</p>
            <div className="auth-segmented-control">
              <button
                type="button"
                onClick={() => setRoleState(ROLES.ADMIN)}
                className={roleState === ROLES.ADMIN ? "active" : ""}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setRoleState(ROLES.STANDARD)}
                className={roleState === ROLES.STANDARD ? "active" : ""}
              >
                Standard
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
              {success ? "Close" : "Cancel"}
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
