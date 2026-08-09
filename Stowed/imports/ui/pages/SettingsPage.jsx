import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

import { Sites } from "/imports/api/locations/collections";
import { DEFAULT_STOCKTAKE_INTERVAL_DAYS } from "/imports/api/locations/stocktake";
import "../Global.css";
import "./SettingsPage.css";

function SiteIntervalCard({ site }) {
  const currentInterval = site.stocktakeIntervalDays ?? DEFAULT_STOCKTAKE_INTERVAL_DAYS;
  const [intervalDays, setIntervalDays] = useState(String(currentInterval));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    const days = Number(intervalDays);

    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setStatus({
        type: "error",
        message: "Enter a whole number between 1 and 3650 days.",
      });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      await Meteor.callAsync("sites.updateStocktakeInterval", {
        siteId: site._id,
        intervalDays: days,
      });
      setStatus({ type: "success", message: "Schedule saved." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.reason || "The schedule could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  const changed = Number(intervalDays) !== currentInterval;

  return (
    <form className="settings-site-card" onSubmit={handleSubmit}>
      <div className="settings-site-copy">
        <h2>{site.name}</h2>
        <p>{site.description || "No site description."}</p>
      </div>

      <div className="settings-site-controls">
        <label htmlFor={`stocktake-interval-${site._id}`}>Stocktake every</label>
        <div className="settings-interval-row">
          <input
            id={`stocktake-interval-${site._id}`}
            type="number"
            min="1"
            max="3650"
            step="1"
            value={intervalDays}
            disabled={saving}
            onChange={(event) => {
              setIntervalDays(event.target.value);
              setStatus({ type: "", message: "" });
            }}
          />
          <span>days</span>
          <button type="submit" className="btn-primary" disabled={saving || !changed}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {status.message && (
          <p className={`settings-form-status ${status.type}`} role="status" aria-live="polite">
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function SettingsPage() {
  const { loading, sites } = useTracker(() => {
    const handle = Meteor.subscribe("locations.all");
    return {
      loading: !handle.ready(),
      sites: Sites.find({}, { sort: { name: 1 } }).fetch(),
    };
  }, []);

  return (
    <div className="product-detail-container settings-page">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Tools</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Settings</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">
            Stocktake <em>Settings</em>
          </h1>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-intro">
          <h2>Stocktake schedules</h2>
          <p>
            Set how often each site should complete a stocktake. Locations appear in Alerts when
            their site's deadline is approaching or has passed.
          </p>
        </div>

        {loading ? (
          <div className="settings-empty">Loading settings…</div>
        ) : sites.length === 0 ? (
          <div className="settings-empty">
            Create a site on the Locations page before configuring its stocktake schedule.
          </div>
        ) : (
          <div className="settings-site-list">
            {sites.map((site) => (
              <SiteIntervalCard key={site._id} site={site} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
