import { Meteor } from "meteor/meteor";
import { Resend } from "./resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || Meteor.settings?.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || Meteor.settings?.RESEND_FROM || "myapp@resend.dev";

let resendClient = null;
function getClient() {
  if (!RESEND_API_KEY) {
    throw new Meteor.Error(
      "resend-not-configured",
      "RESEND_API_KEY is not set (add it to settings.json and run meteor with --settings settings.json).",
    );
  }
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

// Sends an HTML email via Resend to one or more recipients.
export async function sendEmail({ to, subject, html }) {
  const client = getClient();
  const { data, error } = await client.emails.send({
    from: RESEND_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Meteor.Error("email-send-failed", error.message || "Failed to send email.");
  }

  return data;
}
