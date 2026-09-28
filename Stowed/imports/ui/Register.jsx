import { Meteor } from "meteor/meteor";
import "./Register.css";
import { ROLES } from "../api/roles";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasClientPermission } from "../api/userMethods";
import { useAuth } from "../api/useAuth";
import { validateOrgCode } from "../api/organisations";

// Server errors that belong to a specific field are shown inline under it.
const SERVER_ERROR_FIELDS = {
  "org-required": "orgCode",
  "invalid-org-code": "orgCode",
  "org-exists": "orgCode",
  "org-name-required": "orgName",
  "email-taken": "email",
  "username-taken": "username",
  "invalid-password": "password",
};

/**
 * Registration Page
 */
const Register = () => {
  const navigate = useNavigate();

  // stores all form input values
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [roleState, setRoleState] = useState(ROLES.STANDARD);
  const [orgCode, setOrgCode] = useState("");
  const [orgName, setOrgName] = useState("");

  // get details of current user
  const { isLoggedIn, role } = useAuth();
  const isPrivileged = hasClientPermission(role, "create-users");

  const { username, email, password, confirmPassword } = formData;

  // returns an error message for one field, or "" when it is valid
  const validateField = (field, values) => {
    switch (field) {
      case "orgName":
        return !isPrivileged && !values.orgName.trim() ? "Organisation name is required." : "";
      case "orgCode":
        return isPrivileged ? "" : validateOrgCode(values.orgCode);
      case "username":
        return values.username.trim() ? "" : "Username is required.";
      case "email":
        if (!values.email.trim()) return "Email is required.";
        return /^.+@.+\..+$/.test(values.email)
          ? ""
          : "Enter a valid email, e.g. name@example.com.";
      case "password":
        return values.password.length < 6 ? "Password must be at least 6 characters." : "";
      case "confirmPassword":
        return values.password !== values.confirmPassword ? "Passwords do not match." : "";
      default:
        return "";
    }
  };

  const currentValues = () => ({ ...formData, orgCode, orgName });

  const setFieldError = (field, message) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  // validate a field when the user leaves it
  const onBlur = (field) => {
    setFieldError(field, validateField(field, currentValues()));
  };

  // clear a field's error once the user fixes it
  const revalidateIfShown = (field, values) => {
    if (fieldErrors[field]) setFieldError(field, validateField(field, values));
  };

  const onChange = (e) => {
    const next = { ...formData, [e.target.name]: e.target.value };
    setFormData(next);
    revalidateIfShown(e.target.name, { ...next, orgCode, orgName });
    if (e.target.name === "password") {
      revalidateIfShown("confirmPassword", { ...next, orgCode, orgName });
    }
  };

  const fieldProps = (field) => ({
    onBlur: () => onBlur(field),
    "aria-invalid": fieldErrors[field] ? "true" : undefined,
    "aria-describedby": fieldErrors[field] ? `${field}-error` : undefined,
  });

  const renderFieldError = (field) =>
    fieldErrors[field] ? (
      <span id={`${field}-error`} className="auth-field-error" role="alert">
        {fieldErrors[field]}
      </span>
    ) : null;

  // handles form submission
  const onSubmit = async (e) => {
    e.preventDefault();

    const fields = ["orgName", "orgCode", "username", "email", "password", "confirmPassword"];
    const values = currentValues();
    const errors = {};
    fields.forEach((field) => {
      const message = validateField(field, values);
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
      // admin/owner creates user
      if (isPrivileged) {
        await Meteor.callAsync("users.create", {
          username,
          email,
          password,
          role: roleState,
        });

        setSuccess(`User created: ${username}`);
      }
      // self registration
      else {
        await Meteor.callAsync("users.register", {
          username,
          email,
          password,
          orgCode: orgCode.trim(),
          orgName: orgName.trim(),
        });

        setSuccess(`Account created for ${username}`);

        // redirect to login page
        navigate("/login");
      }

      setFormData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
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
    <div className="auth-page">
      <section className="auth-shell" aria-label="Create account">
        <div className="auth-brand-panel">
          <p className="auth-kicker">Stocktake / Users</p>
          <h1>{isPrivileged ? "Add a team member" : "Start mapping with Stowed"}</h1>
          <p>
            Give people access to manage products, update stock counts, and maintain storage
            locations.
          </p>
          <ul className="auth-feature-list">
            <li>Shop and home floor layouts</li>
            <li>QR labels for fast product lookup</li>
            <li>Shopping lists from stock needs</li>
          </ul>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <div>
              <p className="auth-kicker">Account setup</p>
              <h2>Setup your Organisation</h2>
            </div>

            {!isLoggedIn && (
              <button type="button" onClick={() => navigate("/login")} className="auth-link-button">
                Back to login
              </button>
            )}
          </div>

          {error && (
            <div className="auth-status auth-status-error" role="alert">
              {error}
            </div>
          )}
          {success && <div className="auth-status auth-status-success">{success}</div>}

          <form onSubmit={onSubmit} className="auth-form" noValidate>
            {!isPrivileged && (
              <>
                <label className="auth-field">
                  <span>Organisation Name</span>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      revalidateIfShown("orgName", {
                        ...formData,
                        orgCode,
                        orgName: e.target.value,
                      });
                    }}
                    className="auth-input"
                    placeholder="e.g. Acme Warehouse"
                    required
                    {...fieldProps("orgName")}
                  />
                  {renderFieldError("orgName")}
                </label>
                <label className="auth-field">
                  <span>Create an Organisation Code</span>
                  <input
                    type="text"
                    value={orgCode}
                    onChange={(e) => {
                      setOrgCode(e.target.value);
                      revalidateIfShown("orgCode", {
                        ...formData,
                        orgName,
                        orgCode: e.target.value,
                      });
                    }}
                    className="auth-input"
                    placeholder="e.g. acme-warehouse"
                    maxLength={20}
                    required
                    {...fieldProps("orgCode")}
                    aria-describedby={
                      fieldErrors.orgCode ? "orgCode-hint orgCode-error" : "orgCode-hint"
                    }
                  />
                  <span id="orgCode-hint" className="auth-field-hint">
                    Make up a short, unique code for your organisation (letters, numbers, - or _).
                    You and your team will enter it every time you log in.
                  </span>
                  {renderFieldError("orgCode")}
                </label>
              </>
            )}
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
              <span>Password</span>
              <input
                className="auth-input"
                type="password"
                name="password"
                value={password}
                onChange={onChange}
                required
                {...fieldProps("password")}
              />
              {renderFieldError("password")}
            </label>

            <label className="auth-field">
              <span>Confirm Password</span>
              <input
                className="auth-input"
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={onChange}
                required
                {...fieldProps("confirmPassword")}
              />
              {renderFieldError("confirmPassword")}
            </label>

            {isLoggedIn && isPrivileged && (
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
            )}

            <button type="submit" disabled={loading} className="auth-primary-button">
              {loading ? "Creating..." : "Register"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export { Register };
