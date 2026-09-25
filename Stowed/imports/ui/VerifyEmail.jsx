import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Accounts } from "meteor/accounts-base";

const attempted = new Set();

export const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    if (attempted.has(token)) return;
    attempted.add(token);
    Accounts.verifyEmail(token, (err) => {
      if (err) return setStatus("error");
      navigate("/dashboard", { replace: true });
    });
  }, [token, navigate]);

  if (status === "error") return <p>Link is invalid or expired.</p>;
  return <p>Verifying…</p>;
};