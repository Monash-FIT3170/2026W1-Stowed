import { Meteor } from "meteor/meteor";
import { Resend } from "resend";

let resendClient = null;
let clientKey = null;

function getClient() {
  const apiKey = process.env.RESEND_API_KEY || Meteor.settings?.RESEND_API_KEY;
  if (!apiKey) {
    throw new Meteor.Error(
      "resend-not-configured",
      "RESEND_API_KEY is not set (add it to a .env file at the project root).",
    );
  }
  if (!resendClient || clientKey !== apiKey) {
    resendClient = new Resend(apiKey);
    clientKey = apiKey;
  }
  return resendClient;
}

// Sends an HTML email via Resend to one or more recipients.
export async function sendEmail({ to, subject, html }) {
  const client = getClient();
  const from = process.env.RESEND_FROM || Meteor.settings?.RESEND_FROM || "myapp@resend.dev";
  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Meteor.Error("email-send-failed", error.message || "Failed to send email.");
  }

  return data;
}
