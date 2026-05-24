import { NavLink } from "react-router-dom";
import { logoutUser } from "/imports/api/userMethods";
import { hasClientPermission } from "/imports/api/userMethods";
import { useNavigate } from "react-router-dom";
import { useTracker } from "meteor/react-meteor-data";
import { ROLES } from "/imports/api/roles";
import { Organisations } from "/imports/api/organisations";
import React, { useEffect, useRef, useState } from "react";
import "./Global.css";
import "./Sidebar.css";

const WORKSPACE_LINKS = [
  { to: "/locations",  label: "Locations",      icon: "📍" },
  { to: "/floor-map",  label: "Floor Map",      icon: "🗺" },
  { to: "/inventory",  label: "Inventory",      icon: "📦" },
  { to: "/",           label: "Inventory Page", icon: "✓"  },
  { to: "/lists",      label: "Lists",          icon: "🛒" },
];

const TOOL_LINKS = [
  { to: "/qr-codes", label: "QR Codes", icon: "⚏" },
  { to: "/forecast", label: "Forecast", icon: "🔮" },
  { to: "/alerts",   label: "Alerts",   icon: "⚠️" },
];

function SidebarLink({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-link${isActive ? " active" : ""}`
      }
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

  const [orgSubReady, setOrgSubReady] = useState(false);
  useEffect(() => {
    if (!currentUser) return;
    const sub = Meteor.subscribe("currentOrganisation");
    sub.ready() ? setOrgSubReady(true) : setOrgSubReady(false);
    const interval = setInterval(() => {
      setOrgSubReady(sub.ready());
    }, 100);
    return () => {
      sub.stop();
      clearInterval(interval);
    };
  }, [currentUser?._id]);

  const organisation = useTracker(() => {
    if (!currentUser || !orgSubReady) return null;
    return Organisations.findOne(currentUser.profile.organisationId);
  }, [currentUser?.profile?.organisationId, orgSubReady]);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const ACCOUNT_LINKS = [{ to: "/register", label: "Create Account" }];
  if (role >= ROLES.OWNER) {
    ACCOUNT_LINKS.push({ to: "/accounts", label: "Manage Accounts" });
  }

  return (
    <aside className="sidebar">
      {/* Top — logo + nav */}
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">
            Stowed<span className="sidebar-logo-dot">.</span>
          </div>
          <div className="sidebar-logo-tagline">a place for everything</div>
        </div>

        {isLoggedIn && organisation && (
          <div className="sidebar-org">
            {organisation.name}
          </div>
        )}

        <nav className="sidebar-nav">
          <section className="sidebar-section">
            <SectionLabel label="Workspace" />
            {WORKSPACE_LINKS.filter((link) =>
              hasClientPermission(role, `route:${link.to}`)
            ).map((link) => (
              <SidebarLink key={link.to} {...link} end={link.to === "/"} />
            ))}
          </section>

          <section className="sidebar-section">
            <SectionLabel label="Tools" />
            {TOOL_LINKS.map((link) => (
              <SidebarLink key={link.to} {...link} />
            ))}
          </section>

          <section className="sidebar-section">
            <SectionLabel label="Account" />
            {ACCOUNT_LINKS.filter((link) => {
              if (link.to === "/register") {
                return hasClientPermission(role, "create-users");
              }
              return true;
            }).map((link) => (
              <SidebarLink key={link.to} to={link.to} label={link.label} />
            ))}
            {isLoggedIn && (
              <button className="sidebar-logout" onClick={handleLogout}>
                Logout
              </button>
            )}
          </section>
        </nav>
      </div>

      {/* Bottom — logged in as */}
      {isLoggedIn && (
        <div className="sidebar-user">Logged in as {username}</div>
      )}
    </aside>
  );
}
