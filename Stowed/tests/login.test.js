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
  it("renders login fields and submit action", function () {
    const html = renderLogin();
    assert.ok(html.includes("Organisation Code"));
    assert.ok(html.includes("Email or Username"));
    assert.ok(html.includes("Password"));
    assert.ok(html.includes("Log In"));
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
