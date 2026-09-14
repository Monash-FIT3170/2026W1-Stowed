import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import "./Register.css";

/**
 * Login Page
 *
 * Two stages inside the one card and the one form, without leaving /login:
 *
 *  1. ORG - the organisation code, then a choice: continue as a guest
 *     (the customer area) or log in to a staff account.
 *  2. CREDENTIALS - email/username and password appear beneath the code, and
 *     the guest button gives way to a back button.
 *
 * Both choices need the code first, so the buttons stay disabled until one is
 * typed. "Continue as guest" hands the code to the /org gateway, which checks
 * it exists before opening the customer area. "Log in" is the form's submit in
 * both stages: it advances to the credentials in stage 1 and logs in from
 * stage 2, so Enter does the right thing in either.
 */

const STAGE = {
  ORG: "org",
  CREDENTIALS: "credentials",
};

export const Login = () => {
  const [stage, setStage] = useState(STAGE.ORG);
  const [orgCode, setOrgCode] = useState(""); // organisation code
  const [login, setLogin] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const hasOrgCode = orgCode.trim().length > 0;
  const onCredentials = stage === STAGE.CREDENTIALS;

  // The gateway owns the check: it confirms the code exists, ends any staff
  // session, stores the code and opens the customer area - or shows its own
  // not-found error. Nothing here needs to know which.
  const handleContinueAsGuest = () => {
    if (!hasOrgCode) return;
    navigate(`/org/${encodeURIComponent(orgCode.trim().toLowerCase())}`);
  };

  const handleBack = () => {
    setError("");
    setStage(STAGE.ORG);
  };

  const handleLogin = async () => {
    setError("");

    // 1. Organisation required first
    if (!orgCode.trim()) {
      setError("Please enter your organisation code.");
      return;
    }

    // 2. Other fields
    if (!login.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      await Meteor.callAsync("users.checkOrganisation", {
        orgCode: orgCode.trim(),
        login: login.trim(),
      });

      // Compound the username with the org code so Meteor can find the globally-unique account
      const identifier = login.includes("@")
        ? login
        : { username: `${orgCode.trim().toLowerCase()}~${login.trim()}` };

      await new Promise((resolve, reject) => {
        Meteor.loginWithPassword(identifier, password, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      navigate("/dashboard");
    } catch (err) {
      const reason = err.reason || err.message || "";
      if (reason.toLowerCase().includes("incorrect password")) {
        setError("Incorrect password. Please try again.");
      } else if (
        reason.toLowerCase().includes("user not found") ||
        reason.toLowerCase().includes("no user")
      ) {
        setError("No account found with those details.");
      } else if (err.error === "too-many-requests") {
        setError("Too many attempts. Please wait a moment before trying again.");
      } else {
        setError("Login failed. Please check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // One submit handler for both stages, so a click on "Log in" and an Enter in
  // any field take the same path.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onCredentials) {
      if (hasOrgCode) setStage(STAGE.CREDENTIALS);
      return;
    }
    handleLogin();
  };

  const hint = !hasOrgCode
    ? "Enter your organisation code to continue."
    : onCredentials
      ? "Enter the account details for this organisation."
      : "Browse as a guest, or log in to your account.";

  return (
    <div className="auth-page">
      <section className="auth-shell" aria-label="Login">
        <div className="auth-brand-panel">
          <p className="auth-kicker">Stocktake / Floor maps</p>
          <h1>
            Welcome back to <em>Stowed</em>
          </h1>
          <p>Map your shop or home storage, scan QR labels, and keep every product easy to find.</p>
          <ul className="auth-feature-list">
            <li>Storage units and product locations</li>
            <li>Low-stock visual alerts</li>
            <li>Photo-based product catalogue</li>
          </ul>
        </div>

        <div className="auth-card">
          <p className="auth-kicker">Account access</p>
          <h2>{onCredentials ? "Log in" : "Your organisation"}</h2>

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

            {onCredentials && (
              <>
                <label className="auth-field" htmlFor="login">
                  <span>Email or Username</span>
                  <input
                    id="login"
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                    autoFocus
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
              </>
            )}

            <div className="auth-choice">
              {/* The hint changes with the field and the stage, so an empty code
                  explains the disabled buttons and a filled one explains the
                  choice in front of the visitor. */}
              <p className="auth-choice-hint">{hint}</p>
              <div className="auth-button-row">
                {onCredentials ? (
                  <button
                    type="button"
                    className="auth-secondary-button"
                    disabled={loading}
                    onClick={handleBack}
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    className="auth-secondary-button"
                    disabled={!hasOrgCode}
                    onClick={handleContinueAsGuest}
                  >
                    Continue as guest
                  </button>
                )}
                <button
                  type="submit"
                  className="auth-primary-button"
                  disabled={!hasOrgCode || loading}
                >
                  {loading ? "Logging in..." : "Log in"}
                </button>
              </div>
            </div>

            <p className="auth-switch">
              New to Stowed? <Link to="/register">Set up your organisation</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
};
