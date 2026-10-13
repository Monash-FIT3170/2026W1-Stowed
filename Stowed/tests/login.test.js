import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { Login } from "../imports/ui/Login";
import { logoutUser } from "../imports/api/userMethods";

function renderWithoutLayoutEffectWarning(element) {
  const originalError = console.error;

  console.error = (...args) => {
    if (String(args[0]).includes("useLayoutEffect does nothing on the server")) {
      return;
    }
    originalError(...args);
  };

  try {
    return renderToStaticMarkup(element);
  } finally {
    console.error = originalError;
  }
}

function renderLogin() {
  return renderWithoutLayoutEffectWarning(
    React.createElement(MemoryRouter, null, React.createElement(Login)),
  );
}

describe("Authentication - Login", function () {
  // The login is two stages on one card: the organisation code comes first,
  // with a choice to browse as a guest or log in, and the account fields only
  // appear once the visitor chooses to log in.
  it("opens on the organisation stage with guest and log in choices", function () {
    const html = renderLogin();
    assert.ok(html.includes("Organisation Code"));
    assert.ok(html.includes("Continue as guest"));
    assert.ok(html.includes("Log in"));
  });

  it("keeps the account fields hidden until the organisation stage is passed", function () {
    const html = renderLogin();
    assert.ok(!html.includes('id="login"'));
    assert.ok(!html.includes('id="password"'));
  });

  it("links to registration", function () {
    const html = renderLogin();
    assert.ok(html.includes("Set up your organisation"));
  });

  it("logout helper calls Meteor.logout", function () {
    const originalLogout = Meteor.logout;
    let called = false;

    Meteor.logout = () => {
      called = true;
    };

    try {
      logoutUser();
    } finally {
      Meteor.logout = originalLogout;
    }

    assert.strictEqual(called, true);
  });
});
