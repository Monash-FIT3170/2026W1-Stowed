import { NavLink } from "react-router-dom";
//import { useAuth } from "/imports/api/useAuth";
import { logoutUser } from "/imports/api/userMethods";
import { hasClientPermission } from "/imports/api/userMethods";
import { useNavigate } from "react-router-dom";
import { useTracker } from "meteor/react-meteor-data";
import { ROLES } from "/imports/api/roles";

const WORKSPACE_LINKS = [
  { to: "/locations", label: "Locations" },
  { to: "/floor-map", label: "Floor Map" },
  { to: "/inventory", label: "Inventory" },
  { to: "/", label: "Inventory Page" },
  { to: "/lists", label: "Lists" },
];

const TOOL_LINKS = [
  { to: "/qr-codes", label: "QR Codes" },
  { to: "/forecast", label: "Forecast" },
  { to: "/alerts", label: "Alerts" },
];

const ACCOUNT_LINKS = [{ to: "/register", label: "Create Account" }];

function SidebarLink({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center text-base ${isActive ? "bg-black text-white" : "text-black"}`
      }
    >
      <span>{label}</span>
    </NavLink>
  );
}

function SectionLabel({ label }) {
  return (
    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-3 mb-1">
      {label}
    </p>
  );
}

export function Sidebar() {
  const currentUser = useTracker(() => Meteor.user());
  const role = currentUser?.profile?.role;
  const isLoggedIn = !!currentUser;
  const username = currentUser?.username;
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };
  //const { username, isLoggedIn, role } = useAuth();

  const ACCOUNT_LINKS = [{ to: "/register", label: "Create Account" }];
  if (role >= ROLES.OWNER) {
    ACCOUNT_LINKS.push({ to: "/accounts", label: "Manage Accounts" });
  }

  return (
    <aside className="w-48 border-r border-gray-200 bg-white p-4 flex flex-col gap-6">
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            fontSize: "24px",
            fontWeight: 500,
            fontFamily: "Georgia, serif",
          }}
        >
          <em>Stowed</em>
          <em style={{ color: "#B5532A" }}>.</em>
        </div>
        <div style={{ fontSize: "12px", color: "#998874" }}>
          a place for everything
        </div>
      </div>
      {/* Username */}
      <div className="mb-6 text-sm text-gray-600">
        {isLoggedIn ? `Logged in as ${username}` : "Not logged in"}
      </div>

      <nav className="flex flex-col gap-4">
        <section>
          <SectionLabel label="Workspace" />
          <div className="flex flex-col gap-0.5">
            {/* Workspace + tool links
            - checks the user's role before showing each link
            - users only see pages they have permission to access
        */}
            {WORKSPACE_LINKS.filter((link) =>
              hasClientPermission(role, `route:${link.to}`),
            ).map((link) => (
              <SidebarLink key={link.to} {...link} end={link.to === "/"} />
            ))}
            {TOOL_LINKS.filter((link) =>
                hasClientPermission(role, `route:${link.to}`)
              ).map((link) => (
                <SidebarLink key={link.to} {...link} />
              ))}
          </div>
        </section>
        {/* Account section */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Account
          </h3>
          {/* Account links */}
          {ACCOUNT_LINKS.filter((link) => {
            if (link.to === "/register") {
              return hasClientPermission(role, "create-users");
            }

            return true;
          }).map((link) => (
            <SidebarLink key={link.to} {...link} />
          ))}
          {/* logout button */}
          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="text-left text-base text-black"
            >
              Logout
            </button>
          )}
        </section>
      </nav>
    </aside>
  );
}
