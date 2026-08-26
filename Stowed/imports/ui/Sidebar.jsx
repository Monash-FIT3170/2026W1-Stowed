import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { logoutUser } from "/imports/api/userMethods";
import { hasClientPermission } from "/imports/api/userMethods";
import { useNavigate } from "react-router-dom";
import { useTracker } from "meteor/react-meteor-data";
import { ROLES } from "/imports/api/roles";
import { Organisations } from "/imports/api/organisations";
import "./Global.css";
import "./Sidebar.css";

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
  { to: "/alerts", label: "Stocktake alerts", icon: "⚠️" },
];

/* Stroke-only line icons for the slim landscape rail, which is too narrow
   for text — plain geometry instead of colour emoji, to match the [ ] scan
   glyph's monochrome look. */
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  width: "1em",
  height: "1em",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

function WorkspaceIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

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

/**
 * On a laptop this is just a heading and the links below it are always visible.
 * On phones and tablets the sidebar becomes a dock and this turns into the
 * button that opens that section's menu — same markup, driven entirely by CSS.
 * The icon is unused everywhere except the slim landscape capsule, which is
 * too narrow to fit "WORKSPACE"/"TOOLS"/"ACCOUNT" as text — see Sidebar.css.
 */
function SectionLabel({ label, icon, isOpen, onToggle }) {
  return (
    <button
      type="button"
      className={`sidebar-section-label${isOpen ? " open" : ""}`}
      onClick={onToggle}
    >
      <span className="sidebar-section-label-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sidebar-section-label-text">{label}</span>
    </button>
  );
}

export function Sidebar() {
  const currentUser = useTracker(() => Meteor.user());
  const role = currentUser?.profile?.role;
  const isLoggedIn = !!currentUser;
  const username = currentUser?.profile?.username;
  const navigate = useNavigate();

  // Which dock section is open. Always null on a laptop, where every section
  // is expanded anyway, so this costs nothing there.
  const [openSection, setOpenSection] = useState(null);
  const toggle = (name) => setOpenSection((current) => (current === name ? null : name));
  const closeSection = () => setOpenSection(null);

  // A tapped-open dock menu previously stayed open until you tapped that
  // same button again — tapping anywhere else on the screen (or using the
  // back button) now collapses it too, same as the "⋮" menus elsewhere.
  useEffect(() => {
    if (!openSection) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!event.target.closest(".sidebar")) closeSection();
    };
    document.addEventListener("click", closeOnOutsideClick);
    window.addEventListener("popstate", closeSection);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick);
      window.removeEventListener("popstate", closeSection);
    };
  }, [openSection]);

  const organisation = useTracker(() => {
    if (!currentUser) return null;
    // Subscribing inside the tracker lets Meteor reactively re-run this when the
    // subscription becomes ready and clean it up on unmount — no polling needed.
    const sub = Meteor.subscribe("currentOrganisation");
    if (!sub.ready()) return null;
    return Organisations.findOne(currentUser.profile.organisationId);
  }, [currentUser?.profile?.organisationId]);

  const handleLogout = () => {
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

  const sections = [
    {
      label: "Workspace",
      icon: <WorkspaceIcon />,
      links: WORKSPACE_LINKS.filter((link) => hasClientPermission(role, `route:${link.to}`)),
      end: "/dashboard",
    },
    {
      label: "Tools",
      icon: <ToolsIcon />,
      links: TOOL_LINKS.filter((link) => hasClientPermission(role, `route:${link.to}`)),
    },
    {
      label: "Account",
      icon: <AccountIcon />,
      links: ACCOUNT_LINKS,
    },
  ];

  const canScan = hasClientPermission(role, "route:/scan");
  // Split the sections so the scan button renders in the middle of the dock
  // — a row on a phone, a column on the landscape rail — instead of at
  // either end.
  const midpoint = Math.ceil(sections.length / 2);
  const beforeScan = sections.slice(0, midpoint);
  const afterScan = sections.slice(midpoint);

  function renderSection(section) {
    return (
      <section className="sidebar-section" key={section.label}>
        <SectionLabel
          label={section.label}
          icon={section.icon}
          isOpen={openSection === section.label}
          onToggle={() => toggle(section.label)}
        />
        {/* Tapping a link closes the dock menu; harmless on a laptop. */}
        <div
          className={`sidebar-section-links${openSection === section.label ? " open" : ""}`}
          onClick={closeSection}
        >
          {section.links.map((link) => (
            <SidebarLink key={link.to} {...link} end={link.to === section.end} />
          ))}
        </div>
      </section>
    );
  }

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
          {beforeScan.map(renderSection)}
          {canScan && (
            <NavLink
              to="/scan"
              className={({ isActive }) => `sidebar-scan-btn${isActive ? " active" : ""}`}
              aria-label="Scan a barcode or QR code"
              onClick={closeSection}
            >
              <span className="sidebar-scan-icon" aria-hidden="true">
                [ ]
              </span>
              <span className="sidebar-scan-text">Scan</span>
            </NavLink>
          )}
          {afterScan.map(renderSection)}
        </nav>
      </div>

      {/* Bottom - logged in as */}
      {isLoggedIn && <div className="sidebar-user">Logged in as {username}</div>}
      <button className="sidebar-logout" onClick={handleLogout}>
        <span className="sidebar-logout-icon" aria-hidden="true">
          <LogoutIcon />
        </span>
        <span className="sidebar-logout-text">Logout</span>
      </button>
    </aside>
  );
}
