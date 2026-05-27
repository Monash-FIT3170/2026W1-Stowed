import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import "../imports/api/userMethods";
import { Register } from "../imports/ui/Register";
import { ROLES } from "../imports/api/roles";

function renderRegister() {
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(Register)),
  );
}

describe("Authentication - Registration", function () {
  it("renders registration fields for logged-out users", function () {
    const html = renderRegister();
    assert.ok(html.includes("Organisation Name"));
    assert.ok(html.includes("Organisation Code"));
    assert.ok(html.includes("Username"));
    assert.ok(html.includes("Email"));
    assert.ok(html.includes("Password"));
    assert.ok(html.includes("Confirm Password"));
  });

  it("hides role selector when self-registering", function () {
    const html = renderRegister();
    assert.ok(!html.includes("User Type"));
  });

  if (Meteor.isServer) {
    it("rejects short passwords during self-registration", async function () {
      const method = Meteor.server?.method_handlers?.["users.register"];
      assert.ok(method, "users.register method is registered");

      await assert.rejects(
        method.apply({}, [
          {
            username: "tester",
            email: "tester@example.com",
            password: "12345",
            orgCode: "acme",
            orgName: "Acme",
          },
        ]),
        (err) => err?.error === "invalid-password",
      );
    });

    it("rejects short passwords during admin-created user setup", async function () {
      const method = Meteor.server?.method_handlers?.["users.create"];
      assert.ok(method, "users.create method is registered");

      await assert.rejects(
        method.apply({}, [
          {
            username: "staff",
            email: "staff@example.com",
            password: "123",
            role: ROLES.STANDARD,
          },
        ]),
        (err) => err?.error === "invalid-password",
      );
    });
  }
});
