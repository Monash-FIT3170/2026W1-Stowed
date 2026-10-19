import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import "../imports/api/userMethods";
import { Register } from "../imports/ui/Register";
import { CreateAccountModal } from "../imports/ui/components/CreateAccountModal";
import { ROLES } from "../imports/api/roles";

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

function renderRegister() {
  return renderWithoutLayoutEffectWarning(
    React.createElement(MemoryRouter, null, React.createElement(Register)),
  );
}

describe("Authentication - Registration", function () {
  it("renders registration fields for logged-out users", function () {
    const html = renderRegister();
    assert.ok(html.includes("Organisation Name"));
    assert.ok(html.includes("Organisation Code"));
    assert.ok(html.includes("every time you log in"), "explains what the org code is for");
    assert.ok(html.includes("Username"));
    assert.ok(html.includes("Email"));
    assert.ok(html.includes("Password"));
    assert.ok(html.includes("Confirm Password"));
  });

  it("hides role selector when self-registering", function () {
    const html = renderRegister();
    assert.ok(!html.includes("User Type"));
  });

  it("renders the owner create-account modal with a role selector and no org fields", function () {
    const html = renderWithoutLayoutEffectWarning(
      React.createElement(CreateAccountModal, { onClose: () => {} }),
    );
    assert.ok(html.includes("User Type"));
    assert.ok(html.includes("Username"));
    assert.ok(html.includes("Email"));
    assert.ok(html.includes("Confirm Password"));
    assert.ok(!html.includes("Organisation"));
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

    it("requires an organisation name during self-registration", async function () {
      const method = Meteor.server?.method_handlers?.["users.register"];
      assert.ok(method, "users.register method is registered");

      await assert.rejects(
        method.apply({}, [
          {
            username: "tester",
            email: "tester@example.com",
            password: "123456",
            orgCode: "acme",
            orgName: "   ",
          },
        ]),
        (err) => err?.error === "org-name-required",
      );
    });

    it("requires an organisation code during self-registration", async function () {
      const method = Meteor.server?.method_handlers?.["users.register"];
      assert.ok(method, "users.register method is registered");

      await assert.rejects(
        method.apply({}, [
          {
            username: "tester",
            email: "tester@example.com",
            password: "123456",
            orgCode: "   ",
            orgName: "Acme",
          },
        ]),
        (err) => err?.error === "org-required",
      );
    });

    it("requires an organisation code even when the client sends an empty value", async function () {
      const method = Meteor.server?.method_handlers?.["users.register"];

      await assert.rejects(
        method.apply({}, [
          {
            username: "tester",
            email: "tester@example.com",
            password: "123456",
            orgCode: "",
            orgName: "Acme",
          },
        ]),
        (err) =>
          err?.error === "org-required" && err.reason.includes("create an organisation code"),
      );
    });

    it("rejects organisation codes with unsupported characters", async function () {
      const method = Meteor.server?.method_handlers?.["users.register"];

      await assert.rejects(
        method.apply({}, [
          {
            username: "tester",
            email: "tester@example.com",
            password: "123456",
            orgCode: "acme~hq",
            orgName: "Acme",
          },
        ]),
        (err) => err?.error === "invalid-org-code",
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

    it("rejects invalid roles during admin-created user setup", async function () {
      const method = Meteor.server?.method_handlers?.["users.create"];
      assert.ok(method, "users.create method is registered");

      await assert.rejects(
        method.apply({}, [
          {
            username: "staff",
            email: "staff@example.com",
            password: "123456",
            role: ROLES.OWNER,
          },
        ]),
        (err) => err?.error === "invalid-role",
      );
    });
  }
});
