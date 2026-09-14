import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Navigate, useParams } from "react-router-dom";
import { setCustomerOrgCode, clearCustomerOrgCode, endStaffSession } from "../customerSession";
import "../Register.css";

/**
 * ORG GATEWAY
 * Entry point for customers arriving without an account, e.g. /org/monash
 *
 * Reaching this URL means becoming a customer, so any staff login is ended
 * first. The code is then resolved against the Organisations collection: a real
 * one is stored for the browser session and the visitor goes straight to the
 * customer view, an unknown one stops here with an error.
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

    // Landing here restarts the customer session from scratch: whatever
    // organisation a previous visit left behind is dropped before the new code
    // is even looked up, so a revisit can never fall back to the old one.
    clearCustomerOrgCode();

    // Logging out before the lookup, not after, so an unknown code still
    // leaves the staff session closed rather than half-abandoned.
    endStaffSession()
      .then(() => Meteor.callAsync("organisations.exists", { orgCode: orgCode ?? "" }))
      .then((exists) => {
        if (!active) return;
        if (!exists) {
          setChecked({ code: orgCode, status: STATUS.NOT_FOUND });
          return;
        }
        setCustomerOrgCode(orgCode);
        setChecked({ code: orgCode, status: STATUS.FOUND });
      })
      .catch(() => {
        // The code may well be fine - we just could not reach the server, so
        // this stays separate from "no such organisation".
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
