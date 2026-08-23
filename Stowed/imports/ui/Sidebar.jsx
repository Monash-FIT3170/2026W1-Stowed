import { useState } from "react";
import { NavLink } from "react-router-dom";
import { logoutUser } from "/imports/api/userMethods";
import { hasClientPermission } from "/imports/api/userMethods";
import { useLocation, useNavigate } from "react-router-dom";
import { useTracker } from "meteor/react-meteor-data";
import { ROLES } from "/imports/api/roles";
import { Organisations } from "/imports/api/organisations";
import "./Global.css";
import "./SideBar.css";

const WORKSPACE_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: "⌂" },
  { to: "/locations", label: "Locations", icon: "📍" },
  { to: "/floor-map", label: "Floor Map", icon: "🗺" },
  { to: "/inventory", label: "Inventory", icon: "📦" },
  { to: "/lists", label: "Lists", icon: "🛒" },
];

const TOOL_LINKS = [
  { to: "/qr-codes", label: "QR Codes", icon: "⚏" },
  { to: "/forecast", label: "Forecast", icon: "🔮" },
  { to: "/alerts", label: "Alerts", icon: "⚠️" },
];

function SidebarLink({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
    >
      {icon && <span className="sidebar-link-icon">{icon}</span>}
      <span>{label}</span>
    </NavLink>
  );
}

function MobileSidebarLink({ to, label, icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-mobile-link${isActive ? " active" : ""}`}
      onClick={onClick}
    >
      {icon && <span className="sidebar-link-icon">{icon}</span>}
      <span>{label}</span>
    </NavLink>
  );
}

function SectionLabel({ label }) {
  return <p className="sidebar-section-label">{label}</p>;
}

export function Sidebar() {
  const currentUser = useTracker(() => Meteor.user());
  const role = currentUser?.profile?.role;
  const isLoggedIn = !!currentUser;
  const username = currentUser?.profile?.username;
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMobileGroup, setActiveMobileGroup] = useState(null);

  const organisation = useTracker(() => {
    if (!currentUser) return null;
    // Subscribing inside the tracker lets Meteor reactively re-run this when the
    // subscription becomes ready and clean it up on unmount — no polling needed.
    const sub = Meteor.subscribe("currentOrganisation");
    if (!sub.ready()) return null;
    return Organisations.findOne(currentUser.profile.organisationId);
  }, [currentUser?.profile?.organisationId]);

  const handleLogout = () => {
    setActiveMobileGroup(null);
    logoutUser();
    navigate("/login");
  };

  const ALL_ACCOUNT_LINKS = [{ to: "/register", label: "Create Account" }];
  if (role >= ROLES.OWNER) {
    ALL_ACCOUNT_LINKS.push({ to: "/accounts", label: "Manage Accounts" });
  }
  const ACCOUNT_LINKS = ALL_ACCOUNT_LINKS.filter((link) =>
    link.to === "/register" ? hasClientPermission(role, "create-users") : true,
  );
  const workspaceLinks = WORKSPACE_LINKS.filter((link) =>
    hasClientPermission(role, `route:${link.to}`),
  );
  const toolLinks = TOOL_LINKS.filter((link) => hasClientPermission(role, `route:${link.to}`));
  const accountLinks = ACCOUNT_LINKS.filter((link) => {
    if (link.to === "/register") {
      return hasClientPermission(role, "create-users");
    }
    return true;
  });
  const mobileGroups = [
    { key: "workspace", label: "Workspace", icon: "⌂", links: workspaceLinks },
    { key: "tools", label: "Tools", icon: "⚏", links: toolLinks },
    { key: "account", label: "Account", icon: "◎", links: accountLinks },
  ];
  const activeGroup = mobileGroups.find((group) => group.key === activeMobileGroup);

  const isGroupActive = (group) =>
    group.links.some((link) =>
      link.to === "/dashboard"
        ? location.pathname === link.to
        : location.pathname.startsWith(link.to),
    );

  const toggleMobileGroup = (groupKey) => {
    setActiveMobileGroup((currentGroup) => (currentGroup === groupKey ? null : groupKey));
  };

  return (
    <aside className="sidebar">
      {/* Top - logo + nav */}
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">
            Stowed<span className="sidebar-logo-dot">.</span>
          </div>
          <div className="sidebar-logo-tagline">a place for everything</div>
        </div>

        {isLoggedIn && organisation && (
          <div className="sidebar-org">
            <div className="sidebar-org-avatar">{organisation.name.charAt(0).toUpperCase()}</div>
            <div className="sidebar-org-info">
              <div className="sidebar-org-label">Organisation</div>
              <div className="sidebar-org-name">{organisation.name}</div>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          <section className="sidebar-section">
            <SectionLabel label="Workspace" />
            <div className="sidebar-section-links">
              {workspaceLinks.map((link) => (
                <SidebarLink key={link.to} {...link} end={link.to === "/dashboard"} />
              ))}
            </div>
          </section>

          <section className="sidebar-section">
            <SectionLabel label="Tools" />
            <div className="sidebar-section-links">
              {toolLinks.map((link) => (
                <SidebarLink key={link.to} {...link} />
              ))}
            </div>
          </section>

          <section className="sidebar-section">
            <SectionLabel label="Account" />
            <div className="sidebar-section-links">
              {accountLinks.map((link) => (
                <SidebarLink key={link.to} to={link.to} label={link.label} />
              ))}
            </div>
          </section>
        </nav>
      </div>

      <div className="sidebar-mobile-panel" hidden={!activeGroup}>
        {activeGroup && (
          <>
            <div className="sidebar-mobile-panel-title">{activeGroup.label}</div>
            <div className="sidebar-mobile-panel-links">
              {activeGroup.links.map((link) => (
                <MobileSidebarLink
                  key={link.to}
                  {...link}
                  end={link.to === "/dashboard"}
                  onClick={() => setActiveMobileGroup(null)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="sidebar-mobile-tabs" aria-label="Mobile navigation groups">
        {mobileGroups.map((group) => (
          <button
            key={group.key}
            type="button"
            className={`sidebar-mobile-tab${
              activeMobileGroup
                ? activeMobileGroup === group.key
                  ? " active"
                  : ""
                : isGroupActive(group)
                  ? " active"
                  : ""
            }`}
            onClick={() => toggleMobileGroup(group.key)}
            aria-expanded={activeMobileGroup === group.key}
          >
            <span className="sidebar-mobile-tab-icon">{group.icon}</span>
            <span>{group.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom - logged in as */}
      {isLoggedIn && <div className="sidebar-user">Logged in as {username}</div>}
      <button className="sidebar-logout" onClick={handleLogout}>
        <span className="sidebar-mobile-tab-icon">⇥</span>
        <span>Logout</span>
      </button>
    </aside>
  );
}
