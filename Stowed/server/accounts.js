import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { Email } from "meteor/email";
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