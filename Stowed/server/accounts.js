import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { Email } from "meteor/email";
import { check } from "meteor/check";
import { DDPRateLimiter } from "meteor/ddp-rate-limiter";
import { Organisations } from "../imports/api/organisations";
import { sendEmail } from "./email/resend";

Email.customTransport = async ({ to, subject, html }) => {
  await sendEmail({ to, subject, html });
};

Accounts.urls.verifyEmail = (token) => Meteor.absoluteUrl(`verify-email/${token}`);

Accounts.emailTemplates.siteName = "Stowed";
Accounts.emailTemplates.verifyEmail = {
  subject: () => "Verify your Stowed account",
  html: (user, url) => `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;">
      <h2>Welcome to Stowed</h2>
      <p>Confirm your email to finish setting up your account.</p>
      <p><a href="${url}">Verify email</a></p>
    </div>`,
};

Accounts.validateLoginAttempt(({ user, allowed }) => {
  if (!allowed || !user) return false;
  if (user.emails?.some((e) => e.verified)) return true;
  throw new Meteor.Error("email-not-verified", "Please verify your email before logging in.");
});

Meteor.methods({
  async "users.resendVerification"({ orgCode, login }) {
    check(orgCode, String);
    check(login, String);
    const org = await Organisations.findOneAsync({ code: orgCode.trim().toLowerCase() });
    if (!org) return;
    const user = await Meteor.users.findOneAsync({
      "profile.organisationId": org._id,
      $or: [
        { "emails.address": login.trim().toLowerCase() },
        { username: `${org.code}~${login.trim()}` },
      ],
    });
    if (!user || user.emails?.some((e) => e.verified)) return;
    await Accounts.sendVerificationEmail(user._id);
  },
});

DDPRateLimiter.addRule({ type: "method", name: "users.resendVerification" }, 3, 60000);