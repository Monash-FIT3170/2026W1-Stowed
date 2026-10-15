import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "/imports/api/useAuth";
import { hasClientPermission } from "/imports/api/userMethods";
import { OrgDetailsSection } from "./settings/OrgDetailsSection";
import { AccountsSection } from "./settings/AccountsSection";
import { ImportExportSection } from "./settings/ImportExportSection";
import "../Global.css";
import "./SettingsPage.css";

/**
 * Settings page: organisation details, account management (owners only),
 * then data import/export, stacked on one page.
 */
export function SettingsPage() {
  const { role } = useAuth();
  const { hash } = useLocation();
  const canManageAccounts = hasClientPermission(role, "route:/accounts");

  const sections = [
    { id: "org-details", label: "Organisation" },
    ...(canManageAccounts ? [{ id: "accounts", label: "Accounts" }] : []),
    { id: "import-export", label: "Import & Export" },
  ];

  // jump to the section named in the URL, e.g. /settings#accounts
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="product-detail-container">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Account</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Settings</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">
            <em>Settings</em>
          </h1>
        </div>
        <nav className="settings-jump-nav" aria-label="Settings sections">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="settings-wrap">
        <OrgDetailsSection />
        {canManageAccounts && <AccountsSection />}
        <ImportExportSection />
      </div>
    </div>
  );
}
