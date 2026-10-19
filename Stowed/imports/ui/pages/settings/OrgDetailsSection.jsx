import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Organisations } from "/imports/api/organisations";
import { useAuth } from "/imports/api/useAuth";
import { resetTutorial } from "../../tutorial/tutorialStorage";
import "../../Global.css";
import "../SettingsPage.css";

/**
 * Settings section: read-only organisation details, plus replaying the tutorial.
 */
export function OrgDetailsSection() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const organisation = useTracker(() => {
    const orgId = user?.profile?.organisationId;
    if (!orgId) return null;
    const sub = Meteor.subscribe("currentOrganisation");
    if (!sub.ready()) return null;
    return Organisations.findOne(orgId);
  }, [user?.profile?.organisationId]);

  const customerLink = organisation ? `${window.location.origin}/org/${organisation.code}` : "";

  const copyCustomerLink = async () => {
    try {
      await navigator.clipboard.writeText(customerLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <section id="org-details" className="settings-section">
      <h2 className="settings-section-title">Organisation Details</h2>
      <p className="settings-section-desc">The organisation this account belongs to.</p>

      <div className="tools-card bulk-card">
        <div className="export-format-list">
          <div className="export-format-row">
            <div>
              <div className="export-format-title">Name</div>
              <p className="export-format-desc">{organisation?.name ?? "Loading..."}</p>
            </div>
          </div>

          <div className="export-format-row">
            <div>
              <div className="export-format-title">Organisation code</div>
              <p className="export-format-desc">
                <code className="org-code">{organisation?.code ?? "Loading..."}</code>
              </p>
              <p className="export-format-desc">
                Your team enters this code every time they log in.
              </p>
            </div>
          </div>

          <div className="export-format-row">
            <div>
              <div className="export-format-title">Customer link</div>
              <p className="export-format-desc org-link">{customerLink || "Loading..."}</p>
              <p className="export-format-desc">
                Share this so customers can search your products and find them on the floor map.
              </p>
            </div>
            <button className="btn-secondary" onClick={copyCustomerLink} disabled={!customerLink}>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <div className="export-format-row">
            <div>
              <div className="export-format-title">Tutorial</div>
              <p className="export-format-desc">
                Replay the sidebar tour and the quick intros shown on each page.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => resetTutorial(user?._id)}>
              Replay tutorial
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
