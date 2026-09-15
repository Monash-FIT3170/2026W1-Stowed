import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { startCustomerSession } from "../customerSession";
import "../Register.css";

/**
 * ORG GATEWAY
 * Entry point for customers arriving without an account, e.g. /org/monash
 *
 * This is the way in for a printed QR code. The login page's "Continue as
 * guest" does the same job inline; both run startCustomerSession, so the checks
 * live in one place and this page only reports the outcome: a real code goes
 * straight through to the customer view, an unknown one stops here with an
 * error.
 */

const STATUS = {
  CHECKING: "checking",
  FOUND: "found",
  NOT_FOUND: "not-found",
  ERROR: "error",
};

export function OrgGatewayPage() {
  const { orgCode } = useParams();

  // The checked code is held alongside its outcome, so a change of :orgCode
  // reads as "checking" again without an effect having to reset the state.
  const [checked, setChecked] = useState({ code: null, status: STATUS.CHECKING });
  const status = checked.code === orgCode ? checked.status : STATUS.CHECKING;

  useEffect(() => {
    let active = true;

    startCustomerSession(orgCode)
      .then((ok) => {
        if (active) setChecked({ code: orgCode, status: ok ? STATUS.FOUND : STATUS.NOT_FOUND });
      })
      .catch(() => {
        if (active) setChecked({ code: orgCode, status: STATUS.ERROR });
      });

    return () => {
      active = false;
    };
  }, [orgCode]);

  if (status === STATUS.FOUND) {
    return <Navigate to="/customer" replace />;
  }

  // Nothing is painted while the check is in flight, so a valid code goes
  // through to /customer without flashing an intermediate screen.
  if (status === STATUS.CHECKING) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-kicker">Stowed</p>
        <h2>{status === STATUS.NOT_FOUND ? "Organisation not found" : "Something went wrong"}</h2>
        <p className="auth-status auth-status-error">
          {status === STATUS.NOT_FOUND
            ? `No organisation with the code "${orgCode}" exists.`
            : "We could not check that organisation code. Please try again."}
        </p>
      </div>
    </div>
  );
}
